/**
 * Supabase(PostgreSQL) 스토어 — Redis와 동일한 세션/메시지 동작 제공
 */

import { createRequire } from "node:module";
import type { RelayMessage, Session, DeviceType } from "./types.js";
import { TTL } from "./types.js";

const PC_STALE_MS = 2 * 60 * 1000; // 2분

type SupabaseClient = any;
type SupabaseModule = {
  createClient: (url: string, key: string) => SupabaseClient;
};

const require = createRequire(import.meta.url);

let _createClient: SupabaseModule["createClient"] | null = null;
let _client: SupabaseClient | null = null;

function getCreateClient(): SupabaseModule["createClient"] {
  if (_createClient) return _createClient;

  try {
    const mod = require("@supabase/supabase-js") as SupabaseModule;
    if (typeof mod.createClient !== "function") {
      throw new Error("createClient export not found");
    }
    _createClient = mod.createClient;
    return _createClient;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown module load error";
    throw new Error(
      `Supabase SDK is not available. Install dependencies (npm install) before using SUPABASE_URL mode. ${detail}`
    );
  }
}

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
      );
    }
    _client = getCreateClient()(url, key);
  }
  return _client;
}

const nowMs = () => Date.now();
const sessionExpiresAt = () => nowMs() + TTL.session * 1000;
const deviceExpiresAt = () => nowMs() + TTL.device * 1000;
const messageExpiresAt = () => Math.floor(nowMs() / 1000) + TTL.message;

export async function createSession(sessionId: string): Promise<Session> {
  const now = nowMs();
  const session: Session = {
    sessionId,
    createdAt: now,
    expiresAt: now + TTL.session * 1000,
  };
  const { error } = await getClient()
    .from("relay_sessions")
    .upsert(
      {
        session_id: sessionId,
        pc_device_id: null,
        pc_last_seen_at: null,
        pc_pin_hash: null,
        mobile_device_ids: [],
        created_at: session.createdAt,
        expires_at: session.expiresAt,
      },
      { onConflict: "session_id" }
    );
  if (error) throw new Error(`createSession: ${error.message}`);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await getClient()
    .from("relay_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  if (error || !data) return null;
  return rowToSession(data);
}

function rowToSession(row: any): Session {
  return {
    sessionId: row.session_id,
    pcDeviceId: row.pc_device_id ?? undefined,
    pcLastSeenAt: row.pc_last_seen_at ?? undefined,
    pcPinHash: row.pc_pin_hash ?? undefined,
    mobileDeviceIds: Array.isArray(row.mobile_device_ids)
      ? row.mobile_device_ids
      : row.mobile_device_ids
      ? (typeof row.mobile_device_ids === "string"
          ? JSON.parse(row.mobile_device_ids)
          : row.mobile_device_ids)
      : [],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function getSessionIds(): Promise<string[]> {
  const { data } = await getClient()
    .from("relay_sessions")
    .select("session_id");
  return (data || []).map((r: { session_id: string }) => r.session_id);
}

export async function updatePcLastSeen(
  sessionId: string,
  deviceId: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session || session.pcDeviceId !== deviceId) return;
  const { error } = await getClient()
    .from("relay_sessions")
    .update({
      pc_last_seen_at: nowMs(),
      expires_at: sessionExpiresAt(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(`updatePcLastSeen: ${error.message}`);
}

export async function findSessionsWaitingForPC(): Promise<Session[]> {
  const ids = await getSessionIds();
  if (ids.length === 0) return [];
  const now = nowMs();
  const waiting: Session[] = [];
  for (const sid of ids) {
    const session = await getSession(sid);
    if (!session) continue;
    const noPc = !session.pcDeviceId;
    const pcStale =
      session.pcDeviceId &&
      (session.pcLastSeenAt == null ||
        now - session.pcLastSeenAt > PC_STALE_MS);
    if (noPc || pcStale) waiting.push(session);
  }
  waiting.sort((a, b) => {
    const aHasMobile = a.mobileDeviceIds && a.mobileDeviceIds.length > 0;
    const bHasMobile = b.mobileDeviceIds && b.mobileDeviceIds.length > 0;
    if (aHasMobile && !bHasMobile) return -1;
    if (!aHasMobile && bHasMobile) return 1;
    return b.createdAt - a.createdAt;
  });
  return waiting;
}

export async function findSessionsWithMobile(): Promise<Session[]> {
  const ids = await getSessionIds();
  const sessions: Session[] = [];
  for (const sid of ids) {
    const session = await getSession(sid);
    if (!session) continue;
    const hasMobile =
      (session.mobileDeviceIds && session.mobileDeviceIds.length > 0) ||
      !!(session as any).mobileDeviceId;
    if (hasMobile) sessions.push(session);
  }
  sessions.sort((a, b) => b.createdAt - a.createdAt);
  return sessions;
}

export async function joinSession(
  sessionId: string,
  deviceId: string,
  deviceType: DeviceType
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (deviceType === "pc") {
    session.pcDeviceId = deviceId;
    session.pcLastSeenAt = nowMs();
  } else {
    session.mobileDeviceIds = session.mobileDeviceIds || [];
    if (!session.mobileDeviceIds.includes(deviceId))
      session.mobileDeviceIds.push(deviceId);
  }
  session.expiresAt = sessionExpiresAt();

  await getClient()
    .from("relay_sessions")
    .update({
      pc_device_id: session.pcDeviceId ?? null,
      pc_last_seen_at: session.pcLastSeenAt ?? null,
      mobile_device_ids: session.mobileDeviceIds || [],
      expires_at: session.expiresAt,
    })
    .eq("session_id", sessionId);

  await getClient()
    .from("relay_device_sessions")
    .upsert(
      {
        device_id: deviceId,
        session_id: sessionId,
        expires_at: deviceExpiresAt(),
      },
      { onConflict: "device_id" }
    );
  return session;
}

export async function setSessionPinHash(
  sessionId: string,
  pinHash: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  session.pcPinHash = pinHash;
  await getClient()
    .from("relay_sessions")
    .update({
      pc_pin_hash: pinHash,
      expires_at: sessionExpiresAt(),
    })
    .eq("session_id", sessionId);
}

export async function leaveSession(
  sessionId: string,
  deviceId: string,
  deviceType: DeviceType
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (deviceType === "pc") {
    if (session.pcDeviceId === deviceId) session.pcDeviceId = undefined;
  } else {
    if (session.mobileDeviceIds)
      session.mobileDeviceIds = session.mobileDeviceIds.filter(
        (id) => id !== deviceId
      );
    await getClient()
      .from("relay_messages")
      .delete()
      .eq("session_id", sessionId)
      .eq("direction", "pc2device")
      .eq("device_id", deviceId);
  }
  await getClient()
    .from("relay_sessions")
    .update({
      pc_device_id: session.pcDeviceId ?? null,
      mobile_device_ids: session.mobileDeviceIds || [],
      expires_at: sessionExpiresAt(),
    })
    .eq("session_id", sessionId);

  await getClient()
    .from("relay_device_sessions")
    .delete()
    .eq("device_id", deviceId);
  return session;
}

export async function getDeviceSession(
  deviceId: string
): Promise<string | null> {
  const { data } = await getClient()
    .from("relay_device_sessions")
    .select("session_id")
    .eq("device_id", deviceId)
    .single();
  return data?.session_id ?? null;
}

export async function sendMessage(
  sessionId: string,
  message: RelayMessage
): Promise<void> {
  const client = getClient();
  const body = message as unknown as Record<string, unknown>;
  const exp = messageExpiresAt();

  if (message.to === "mobile") {
    const session = await getSession(sessionId);
    if (
      session?.mobileDeviceIds &&
      session.mobileDeviceIds.length > 0
    ) {
      for (const deviceId of session.mobileDeviceIds) {
        await client.from("relay_messages").insert({
          session_id: sessionId,
          direction: "pc2device",
          device_id: deviceId,
          body,
          expires_at: exp,
        });
      }
    }
    await client.from("relay_messages").insert({
      session_id: sessionId,
      direction: "pc2mobile",
      device_id: null,
      body,
      expires_at: exp,
    });
  } else {
    await client.from("relay_messages").insert({
      session_id: sessionId,
      direction: "mobile2pc",
      device_id: null,
      body,
      expires_at: exp,
    });
  }
}

export async function receiveMessages(
  sessionId: string,
  deviceType: DeviceType,
  limit: number = 10,
  deviceId?: string
): Promise<RelayMessage[]> {
  const client = getClient();
  let query = client
    .from("relay_messages")
    .select("id, body")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (deviceType === "mobile") {
    if (deviceId) {
      query = query.eq("direction", "pc2device").eq("device_id", deviceId);
    } else {
      query = query.eq("direction", "pc2mobile").is("device_id", null);
    }
  } else {
    query = query.eq("direction", "mobile2pc");
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r: { id: string | number }) => r.id);
  const messages: RelayMessage[] = rows.map(
    (r: { body: RelayMessage }) => r.body
  );

  await client.from("relay_messages").delete().in("id", ids);
  return messages;
}

export async function hasMessages(
  sessionId: string,
  deviceType: DeviceType,
  deviceId?: string
): Promise<boolean> {
  const client = getClient();
  let query = client
    .from("relay_messages")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1);

  if (deviceType === "mobile") {
    if (deviceId) {
      query = query.eq("direction", "pc2device").eq("device_id", deviceId);
    } else {
      query = query.eq("direction", "pc2mobile").is("device_id", null);
    }
  } else {
    query = query.eq("direction", "mobile2pc");
  }

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  const client = getClient();
  await client.from("relay_messages").delete().eq("session_id", sessionId);
  await client.from("relay_device_sessions").delete().eq("session_id", sessionId);
  if (session.pcDeviceId) {
    await client
      .from("relay_device_sessions")
      .delete()
      .eq("device_id", session.pcDeviceId);
  }
  if (session.mobileDeviceIds?.length) {
    for (const did of session.mobileDeviceIds) {
      await client.from("relay_device_sessions").delete().eq("device_id", did);
    }
  }
  await client.from("relay_sessions").delete().eq("session_id", sessionId);
}
