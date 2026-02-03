/**
 * 릴레이 서버 전체 플로우 테스트
 * 1. Health 2. 세션 생성 3. 모바일 연결 4. PC 연결 5. 모바일→메시지 전송 6. PC 폴링
 * 사용법: node test-relay-full.js
 */

const RELAY_SERVER_URL = "https://relay.jaloveeye.com";

async function test(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    const result = await fn();
    console.log("✅");
    return result;
  } catch (e) {
    console.log("❌", e.message || e);
    throw e;
  }
}

async function main() {
  console.log("\n🧪 Relay Server 전체 테스트");
  console.log(`   URL: ${RELAY_SERVER_URL}\n`);

  let sessionId;
  const mobileDeviceId = `mobile-${Date.now()}`;
  const pcDeviceId = `pc-${Date.now()}`;

  // 1. Health
  await test("GET /api/health", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/health`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || res.statusText);
    return data;
  });

  // 2. 세션 생성
  sessionId = await test("POST /api/session (세션 생성)", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success || !data.data?.sessionId)
      throw new Error(data.error || "No sessionId");
    return data.data.sessionId;
  });
  console.log(`   sessionId: ${sessionId}`);

  // 3. 모바일 연결
  await test("POST /api/connect (모바일)", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        deviceId: mobileDeviceId,
        deviceType: "mobile",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Connect failed");
    return data;
  });

  // 4. PC 연결
  await test("POST /api/connect (PC)", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        deviceId: pcDeviceId,
        deviceType: "pc",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Connect failed");
    return data;
  });

  // 5. 모바일 → 메시지 전송 (insert_text, 프롬프트 시뮬레이션)
  await test("POST /api/send (모바일→insert_text)", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        deviceId: mobileDeviceId,
        deviceType: "mobile",
        type: "insert_text",
        data: {
          type: "insert_text",
          id: String(Date.now()),
          text: "안녕?",
          prompt: true,
          execute: true,
          agentMode: "agent",
        },
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Send failed");
    return data;
  });

  // 6. PC 폴링 (모바일이 보낸 메시지 수신)
  const messages = await test("GET /api/poll (PC, deviceType=pc)", async () => {
    const res = await fetch(
      `${RELAY_SERVER_URL}/api/poll?sessionId=${sessionId}&deviceType=pc`
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Poll failed");
    const msgs = data.data?.messages ?? data.messages ?? [];
    if (msgs.length === 0)
      throw new Error("PC 폴에 메시지 없음 (모바일→PC 큐 비어있음)");
    return msgs;
  });
  console.log(`   수신 메시지 수: ${messages.length}`);
  messages.forEach((m, i) => {
    console.log(
      `   [${i + 1}] type=${m.type}, from=${m.from}, hasData=${!!m.data}`
    );
  });

  // 7. PC → 메시지 전송 (chat_response 시뮬레이션)
  await test("POST /api/send (PC→chat_response)", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        deviceId: pcDeviceId,
        deviceType: "pc",
        type: "chat_response",
        data: {
          type: "chat_response",
          text: "테스트 응답입니다.",
          timestamp: new Date().toISOString(),
          source: "cli",
          clientId: "relay-client",
        },
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Send failed");
    return data;
  });

  // 8. 모바일 폴링 (PC가 보낸 chat_response 수신)
  const mobileMessages =
    await test("GET /api/poll (모바일, deviceType=mobile)", async () => {
      const res = await fetch(
        `${RELAY_SERVER_URL}/api/poll?sessionId=${sessionId}&deviceType=mobile`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Poll failed");
      const msgs = data.data?.messages ?? data.messages ?? [];
      if (msgs.length === 0)
        throw new Error("모바일 폴에 메시지 없음 (PC→모바일 큐 비어있음)");
      return msgs;
    });
  console.log(`   수신 메시지 수: ${mobileMessages.length}`);
  mobileMessages.forEach((m, i) => {
    console.log(
      `   [${i + 1}] type=${m.type}, from=${m.from}, text=${
        m.data?.text?.substring?.(0, 30) ?? "-"
      }`
    );
  });

  console.log("\n✅ 전체 테스트 통과\n");
}

main().catch((e) => {
  console.error("\n❌ 테스트 실패:", e.message || e);
  process.exit(1);
});
