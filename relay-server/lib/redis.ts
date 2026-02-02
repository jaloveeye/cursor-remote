import { Redis } from '@upstash/redis';
import { 
  RelayMessage, 
  Session, 
  DeviceType,
  REDIS_KEYS, 
  TTL 
} from './types.js';

// Upstash Redis 클라이언트 (lazy initialization)
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      const errorMsg = `Redis not configured: URL=${!!url}, Token=${!!token}. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      _redis = new Redis({ url, token });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw new Error(`Failed to initialize Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return _redis;
}

// 호환성을 위한 redis 객체
const redis = {
  set: (...args: Parameters<Redis['set']>) => getRedis().set(...args),
  get: <T>(...args: Parameters<Redis['get']>) => getRedis().get<T>(...args),
  del: (...args: Parameters<Redis['del']>) => getRedis().del(...args),
  lpush: (...args: Parameters<Redis['lpush']>) => getRedis().lpush(...args),
  rpop: <T>(...args: Parameters<Redis['rpop']>) => getRedis().rpop<T>(...args),
  llen: (...args: Parameters<Redis['llen']>) => getRedis().llen(...args),
  expire: (...args: Parameters<Redis['expire']>) => getRedis().expire(...args),
  sadd: (...args: Parameters<Redis['sadd']>) => getRedis().sadd(...args),
  smembers: <T>(...args: Parameters<Redis['smembers']>) => getRedis().smembers<T>(...args),
  srem: (...args: Parameters<Redis['srem']>) => getRedis().srem(...args),
};

// 세션 생성
export async function createSession(sessionId: string): Promise<Session> {
  try {
    const now = Date.now();
    const session: Session = {
      sessionId,
      createdAt: now,
      expiresAt: now + TTL.session * 1000,
    };
    
    await redis.set(
      REDIS_KEYS.session(sessionId), 
      JSON.stringify(session),
      { ex: TTL.session }
    );
    
    // 세션 목록에 추가
    await redis.sadd(REDIS_KEYS.sessionList(), sessionId);
    await redis.expire(REDIS_KEYS.sessionList(), TTL.session);
    
    return session;
  } catch (error) {
    console.error('createSession error:', error);
    throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 세션 조회
export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await redis.get<string>(REDIS_KEYS.session(sessionId));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// PC deviceId가 없는 세션 찾기 (모바일 클라이언트가 이미 연결한 세션 또는 세션만 생성한 경우)
export async function findSessionsWaitingForPC(): Promise<Session[]> {
  try {
    // 세션 목록에서 모든 세션 ID 가져오기
    const sessionIds = await redis.smembers<string[]>(REDIS_KEYS.sessionList());
    if (!sessionIds || sessionIds.length === 0) {
      return [];
    }
    
    // 각 세션을 조회하여 PC deviceId가 없는 세션 찾기
    // mobileDeviceIds가 있으면 모바일 클라이언트가 연결한 세션
    // mobileDeviceIds가 없으면 세션만 생성하고 아직 연결하지 않은 세션
    const waitingSessions: Session[] = [];
    
    for (const sid of sessionIds) {
      const session = await getSession(sid);
      if (session && !session.pcDeviceId) {
        // PC deviceId가 없으면 대기 중인 세션
        // mobileDeviceIds가 있으면 우선순위 높음 (이미 모바일 클라이언트가 연결함)
        waitingSessions.push(session);
      }
    }
    
    // mobileDeviceIds가 있는 세션을 우선순위로 정렬 (최신순)
    waitingSessions.sort((a, b) => {
      // mobileDeviceIds가 있는 세션 우선
      const aHasMobile = a.mobileDeviceIds && a.mobileDeviceIds.length > 0;
      const bHasMobile = b.mobileDeviceIds && b.mobileDeviceIds.length > 0;
      if (aHasMobile && !bHasMobile) return -1;
      if (!aHasMobile && bHasMobile) return 1;
      // 둘 다 같으면 최신순
      return b.createdAt - a.createdAt;
    });
    
    return waitingSessions;
  } catch (error) {
    console.error('findSessionsWaitingForPC error:', error);
    return [];
  }
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
    // 멀티 클라이언트 지원: 배열에 추가 (중복 방지)
    if (!session.mobileDeviceIds) {
      session.mobileDeviceIds = [];
    }
    if (!session.mobileDeviceIds.includes(deviceId)) {
      session.mobileDeviceIds.push(deviceId);
    }
  }
  
  await redis.set(
    REDIS_KEYS.session(sessionId),
    JSON.stringify(session),
    { ex: TTL.session }
  );
  
  // 디바이스 → 세션 매핑 저장
  await redis.set(
    REDIS_KEYS.deviceSession(deviceId),
    sessionId,
    { ex: TTL.device }
  );
  
  return session;
}

// 세션에서 디바이스 연결 해제
export async function leaveSession(
  sessionId: string,
  deviceId: string,
  deviceType: DeviceType
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  
  // 세션에서 디바이스 제거
  if (deviceType === 'pc') {
    if (session.pcDeviceId === deviceId) {
      session.pcDeviceId = undefined;
    }
  } else {
    // 모바일 클라이언트 배열에서 제거
    if (session.mobileDeviceIds) {
      session.mobileDeviceIds = session.mobileDeviceIds.filter(id => id !== deviceId);
    }
    // 해당 클라이언트의 메시지 큐 삭제
    await redis.del(REDIS_KEYS.messagesForDevice(sessionId, deviceId));
  }
  
  await redis.set(
    REDIS_KEYS.session(sessionId),
    JSON.stringify(session),
    { ex: TTL.session }
  );
  
  // 디바이스 → 세션 매핑 삭제
  await redis.del(REDIS_KEYS.deviceSession(deviceId));
  
  return session;
}

// 디바이스의 세션 조회
export async function getDeviceSession(deviceId: string): Promise<string | null> {
  return await redis.get<string>(REDIS_KEYS.deviceSession(deviceId));
}

// 메시지 전송 (큐에 추가)
export async function sendMessage(
  sessionId: string,
  message: RelayMessage
): Promise<void> {
  if (message.to === 'mobile') {
    // PC → Mobile: 세션의 모든 모바일 클라이언트에게 메시지 전송
    const session = await getSession(sessionId);
    if (session && session.mobileDeviceIds && session.mobileDeviceIds.length > 0) {
      // 각 모바일 클라이언트의 개별 큐에 메시지 추가
      for (const deviceId of session.mobileDeviceIds) {
        const queueKey = REDIS_KEYS.messagesForDevice(sessionId, deviceId);
        await redis.lpush(queueKey, JSON.stringify(message));
        await redis.expire(queueKey, TTL.message);
      }
    }
    // 하위 호환: 기존 세션 단위 큐에도 추가 (레거시 클라이언트 지원)
    const legacyQueueKey = REDIS_KEYS.messagesPC2Mobile(sessionId);
    await redis.lpush(legacyQueueKey, JSON.stringify(message));
    await redis.expire(legacyQueueKey, TTL.message);
  } else {
    // Mobile → PC: 세션 단위 큐에 메시지 추가
    const queueKey = REDIS_KEYS.messagesMobile2PC(sessionId);
    await redis.lpush(queueKey, JSON.stringify(message));
    await redis.expire(queueKey, TTL.message);
  }
}

// 메시지 수신 (큐에서 가져오기)
export async function receiveMessages(
  sessionId: string,
  deviceType: DeviceType,
  limit: number = 10,
  deviceId?: string  // 모바일 클라이언트의 경우 deviceId 필요
): Promise<RelayMessage[]> {
  let queueKey: string;
  
  if (deviceType === 'mobile') {
    // 모바일: deviceId가 있으면 개별 큐, 없으면 레거시 세션 단위 큐
    if (deviceId) {
      queueKey = REDIS_KEYS.messagesForDevice(sessionId, deviceId);
    } else {
      queueKey = REDIS_KEYS.messagesPC2Mobile(sessionId);
    }
  } else {
    // PC: 세션 단위 큐
    queueKey = REDIS_KEYS.messagesMobile2PC(sessionId);
  }
  
  // RPOP으로 오래된 메시지부터 가져오기
  const messages: RelayMessage[] = [];
  
  for (let i = 0; i < limit; i++) {
    const data = await redis.rpop<string>(queueKey);
    if (!data) break;
    
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    messages.push(message);
  }
  
  return messages;
}

// 큐에 메시지가 있는지 확인
export async function hasMessages(
  sessionId: string,
  deviceType: DeviceType,
  deviceId?: string
): Promise<boolean> {
  let queueKey: string;
  
  if (deviceType === 'mobile') {
    if (deviceId) {
      queueKey = REDIS_KEYS.messagesForDevice(sessionId, deviceId);
    } else {
      queueKey = REDIS_KEYS.messagesPC2Mobile(sessionId);
    }
  } else {
    queueKey = REDIS_KEYS.messagesMobile2PC(sessionId);
  }
  
  const length = await redis.llen(queueKey);
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
  // 모든 모바일 클라이언트의 디바이스 매핑 및 메시지 큐 삭제
  if (session.mobileDeviceIds && session.mobileDeviceIds.length > 0) {
    for (const deviceId of session.mobileDeviceIds) {
      keysToDelete.push(REDIS_KEYS.deviceSession(deviceId));
      keysToDelete.push(REDIS_KEYS.messagesForDevice(sessionId, deviceId));
    }
  }
  
  await redis.del(...keysToDelete);
  
  // 세션 목록에서도 제거
  await redis.srem(REDIS_KEYS.sessionList(), sessionId);
}

export { redis };
