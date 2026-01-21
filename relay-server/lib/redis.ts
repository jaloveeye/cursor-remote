import { kv } from '@vercel/kv';
import { 
  RelayMessage, 
  Session, 
  DeviceInfo, 
  DeviceType,
  REDIS_KEYS, 
  TTL 
} from './types';

// Vercel KV 클라이언트
// 환경변수: KV_REST_API_URL, KV_REST_API_TOKEN (Vercel에서 자동 설정)

// 세션 생성
export async function createSession(sessionId: string): Promise<Session> {
  const now = Date.now();
  const session: Session = {
    sessionId,
    createdAt: now,
    expiresAt: now + TTL.session * 1000,
  };
  
  await kv.set(
    REDIS_KEYS.session(sessionId), 
    JSON.stringify(session),
    { ex: TTL.session }
  );
  
  return session;
}

// 세션 조회
export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await kv.get<string>(REDIS_KEYS.session(sessionId));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// 세션에 디바이스 연결
export async function joinSession(
  sessionId: string, 
  deviceId: string, 
  deviceType: DeviceType
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  
  // 세션 업데이트
  if (deviceType === 'pc') {
    session.pcDeviceId = deviceId;
  } else {
    session.mobileDeviceId = deviceId;
  }
  
  await kv.set(
    REDIS_KEYS.session(sessionId),
    JSON.stringify(session),
    { ex: TTL.session }
  );
  
  // 디바이스 → 세션 매핑 저장
  await kv.set(
    REDIS_KEYS.deviceSession(deviceId),
    sessionId,
    { ex: TTL.device }
  );
  
  return session;
}

// 디바이스의 세션 조회
export async function getDeviceSession(deviceId: string): Promise<string | null> {
  return await kv.get<string>(REDIS_KEYS.deviceSession(deviceId));
}

// 메시지 전송 (큐에 추가)
export async function sendMessage(
  sessionId: string,
  message: RelayMessage
): Promise<void> {
  const queueKey = message.to === 'mobile' 
    ? REDIS_KEYS.messagesPC2Mobile(sessionId)
    : REDIS_KEYS.messagesMobile2PC(sessionId);
  
  // 리스트에 메시지 추가 (LPUSH)
  await kv.lpush(queueKey, JSON.stringify(message));
  
  // TTL 설정
  await kv.expire(queueKey, TTL.message);
}

// 메시지 수신 (큐에서 가져오기)
export async function receiveMessages(
  sessionId: string,
  deviceType: DeviceType,
  limit: number = 10
): Promise<RelayMessage[]> {
  const queueKey = deviceType === 'mobile'
    ? REDIS_KEYS.messagesPC2Mobile(sessionId)
    : REDIS_KEYS.messagesMobile2PC(sessionId);
  
  // RPOP으로 오래된 메시지부터 가져오기
  const messages: RelayMessage[] = [];
  
  for (let i = 0; i < limit; i++) {
    const data = await kv.rpop<string>(queueKey);
    if (!data) break;
    
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    messages.push(message);
  }
  
  return messages;
}

// 큐에 메시지가 있는지 확인
export async function hasMessages(
  sessionId: string,
  deviceType: DeviceType
): Promise<boolean> {
  const queueKey = deviceType === 'mobile'
    ? REDIS_KEYS.messagesPC2Mobile(sessionId)
    : REDIS_KEYS.messagesMobile2PC(sessionId);
  
  const length = await kv.llen(queueKey);
  return length > 0;
}

// 세션 삭제
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  
  // 관련 키 모두 삭제
  const keysToDelete = [
    REDIS_KEYS.session(sessionId),
    REDIS_KEYS.messagesPC2Mobile(sessionId),
    REDIS_KEYS.messagesMobile2PC(sessionId),
  ];
  
  if (session.pcDeviceId) {
    keysToDelete.push(REDIS_KEYS.deviceSession(session.pcDeviceId));
  }
  if (session.mobileDeviceId) {
    keysToDelete.push(REDIS_KEYS.deviceSession(session.mobileDeviceId));
  }
  
  await kv.del(...keysToDelete);
}

export { kv };
