/**
 * sessions-waiting-for-pc / pcLastSeenAt(stale PC) 동작 테스트
 * - 모바일만 연결 → 대기 목록에 세션 포함
 * - PC 연결 후 → 대기 목록에서 제외
 * - PC 폴링 시 deviceId 전달 시 pcLastSeenAt 갱신됨 (2분 후 stale로 다시 대기 목록에 뜸)
 *
 * 사용법: node test-relay-sessions-waiting.js [RELAY_URL]
 * 예: node test-relay-sessions-waiting.js
 *     node test-relay-sessions-waiting.js https://relay.jaloveeye.com
 */

const RELAY_SERVER_URL =
  process.argv[2] ||
  process.env.RELAY_SERVER_URL ||
  "https://relay.jaloveeye.com";

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
  console.log("\n🧪 sessions-waiting-for-pc / pcLastSeenAt 테스트");
  console.log(`   URL: ${RELAY_SERVER_URL}\n`);

  let sessionId;
  const mobileDeviceId = `mobile-${Date.now()}`;
  const pcDeviceId = `pc-${Date.now()}`;

  // 1. 세션 생성
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

  // 2. 모바일만 연결 → GET sessions-waiting-for-pc 에 세션이 있어야 함
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

  const waitingAfterMobile =
    await test("GET /api/sessions-waiting-for-pc (모바일만 연결 후)", async () => {
      const res = await fetch(
        `${RELAY_SERVER_URL}/api/sessions-waiting-for-pc`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "API failed");
      const sessions = data.data?.sessions ?? [];
      const found = sessions.some((s) => s.sessionId === sessionId);
      if (!found || sessions.length === 0)
        throw new Error(
          `세션이 대기 목록에 없음 (sessions=${sessions.length}, sessionId=${sessionId})`
        );
      return sessions;
    });
  console.log(
    `   대기 목록 세션 수: ${waitingAfterMobile.length}, 포함 여부: ✅`
  );

  // 3. PC 연결 → GET sessions-waiting-for-pc 에 이 세션이 없어야 함
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

  // PC가 한 번 폴링 (deviceId 포함) → pcLastSeenAt 갱신
  await test("GET /api/poll (PC, deviceId 포함)", async () => {
    const res = await fetch(
      `${RELAY_SERVER_URL}/api/poll?sessionId=${sessionId}&deviceType=pc&deviceId=${encodeURIComponent(
        pcDeviceId
      )}`
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Poll failed");
    return data;
  });

  const waitingAfterPc =
    await test("GET /api/sessions-waiting-for-pc (PC 연결·폴링 후)", async () => {
      const res = await fetch(
        `${RELAY_SERVER_URL}/api/sessions-waiting-for-pc`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "API failed");
      const sessions = data.data?.sessions ?? [];
      const found = sessions.some((s) => s.sessionId === sessionId);
      if (found)
        throw new Error(
          `PC 연결 후에도 세션이 대기 목록에 있음 (세션은 PC 대기 아님)`
        );
      return sessions;
    });
  console.log(
    `   대기 목록에 이 세션 없음 (의도대로 제외됨), 전체 대기: ${waitingAfterPc.length}`
  );

  // 4. debug-sessions 확인
  const debugData = await test("GET /api/debug-sessions", async () => {
    const res = await fetch(`${RELAY_SERVER_URL}/api/debug-sessions`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "API failed");
    return data.data;
  });
  console.log(
    `   totalSessions=${debugData.totalSessions}, waitingForPc=${
      debugData.waitingForPc
    }, hint=${debugData.hint ?? "-"}`
  );

  console.log("\n✅ sessions-waiting-for-pc 테스트 통과\n");
  console.log("※ PC 끊김 후 2분 지나면 같은 세션이 다시 '대기 중'으로 뜹니다.");
  console.log(
    "  수동 확인: PC 연결 후 Cursor 종료 → 2분 대기 → GET sessions-waiting-for-pc 에 세션 포함되는지 확인.\n"
  );
}

main().catch((e) => {
  console.error("\n❌ 테스트 실패:", e.message || e);
  process.exit(1);
});
