/**
 * 스토어 진입점. SUPABASE_URL 이 있으면 Supabase, 없으면 Redis(Upstash) 사용.
 */

import * as redisStore from "./redis.js";
import * as supabaseStore from "./supabase-store.js";

const useSupabase = !!process.env.SUPABASE_URL;

export const createSession = useSupabase
  ? supabaseStore.createSession
  : redisStore.createSession;
export const getSession = useSupabase
  ? supabaseStore.getSession
  : redisStore.getSession;
export const getSessionIds = useSupabase
  ? supabaseStore.getSessionIds
  : redisStore.getSessionIds;
export const updatePcLastSeen = useSupabase
  ? supabaseStore.updatePcLastSeen
  : redisStore.updatePcLastSeen;
export const findSessionsWaitingForPC = useSupabase
  ? supabaseStore.findSessionsWaitingForPC
  : redisStore.findSessionsWaitingForPC;
export const findSessionsWithMobile = useSupabase
  ? supabaseStore.findSessionsWithMobile
  : redisStore.findSessionsWithMobile;
export const joinSession = useSupabase
  ? supabaseStore.joinSession
  : redisStore.joinSession;
export const setSessionPinHash = useSupabase
  ? supabaseStore.setSessionPinHash
  : redisStore.setSessionPinHash;
export const leaveSession = useSupabase
  ? supabaseStore.leaveSession
  : redisStore.leaveSession;
export const getDeviceSession = useSupabase
  ? supabaseStore.getDeviceSession
  : redisStore.getDeviceSession;
export const sendMessage = useSupabase
  ? supabaseStore.sendMessage
  : redisStore.sendMessage;
export const receiveMessages = useSupabase
  ? supabaseStore.receiveMessages
  : redisStore.receiveMessages;
export const hasMessages = useSupabase
  ? supabaseStore.hasMessages
  : redisStore.hasMessages;
export const deleteSession = useSupabase
  ? supabaseStore.deleteSession
  : redisStore.deleteSession;
