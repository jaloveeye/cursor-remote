/**
 * 릴레이 서버 메시지 확인 스크립트
 * 사용법: node test-relay-message.js <sessionId>
 */

const RELAY_SERVER_URL = 'https://relay.jaloveeye.com';
const sessionId = process.argv[2];

if (!sessionId) {
    console.error('Usage: node test-relay-message.js <sessionId>');
    process.exit(1);
}

async function checkMessages() {
    try {
        console.log(`\n🔍 Checking messages for session: ${sessionId}`);
        console.log(`📡 Relay Server: ${RELAY_SERVER_URL}\n`);

        // PC deviceType으로 폴링 (Extension이 받아야 할 메시지)
        const pollUrl = `${RELAY_SERVER_URL}/api/poll?sessionId=${sessionId}&deviceType=pc`;
        console.log(`📥 Polling URL: ${pollUrl}\n`);

        const response = await fetch(pollUrl);
        const data = await response.json();

        console.log('📊 Poll Response:');
        console.log(JSON.stringify(data, null, 2));

        if (data.success && data.data?.messages) {
            const messages = data.data.messages;
            console.log(`\n✅ Found ${messages.length} message(s) in queue`);
            
            messages.forEach((msg, index) => {
                console.log(`\n📨 Message ${index + 1}:`);
                console.log(`   ID: ${msg.id}`);
                console.log(`   Type: ${msg.type}`);
                console.log(`   From: ${msg.from}`);
                console.log(`   To: ${msg.to}`);
                console.log(`   Data: ${JSON.stringify(msg.data, null, 2)}`);
                console.log(`   Timestamp: ${new Date(msg.timestamp).toLocaleString()}`);
            });
        } else {
            console.log('\n⚠️ No messages in queue');
            if (!data.success) {
                console.log(`❌ Error: ${data.error}`);
            }
        }

        // 세션 정보도 확인
        console.log(`\n\n🔍 Checking session info...`);
        const sessionUrl = `${RELAY_SERVER_URL}/api/session?sessionId=${sessionId}`;
        const sessionResponse = await fetch(sessionUrl);
        const sessionData = await sessionResponse.json();

        console.log('📊 Session Info:');
        console.log(JSON.stringify(sessionData, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
    }
}

checkMessages();
