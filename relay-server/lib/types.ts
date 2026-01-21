// 메시지 타입 정의

export type DeviceType = 'mobile' | 'pc';

export interface RelayMessage {
  id: string;
  type: string;
  from: DeviceType;
  to: DeviceType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: DeviceType;
  sessionId: string;
  connectedAt: number;
  lastSeen: number;
}

export interface Session {
  sessionId: string;
  pcDeviceId?: string;
  mobileDeviceId?: string;
  createdAt: number;
  expiresAt: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Redis 키 패턴
export const REDIS_KEYS = {
  // 세션 정보
  session: (sessionId: string) => `session:${sessionId}`,
  // 디바이스 → 세션 매핑
  deviceSession: (deviceId: string) => `device:${deviceId}:session`,
  // 메시지 큐 (PC → Mobile)
  messagesPC2Mobile: (sessionId: string) => `messages:${sessionId}:pc2mobile`,
  // 메시지 큐 (Mobile → PC)
  messagesMobile2PC: (sessionId: string) => `messages:${sessionId}:mobile2pc`,
  // 푸시 알림용 pubsub 채널
  channel: (sessionId: string, target: DeviceType) => `channel:${sessionId}:${target}`,
} as const;

// TTL 설정 (초)
export const TTL = {
  session: 24 * 60 * 60, // 24시간
  message: 5 * 60, // 5분
  device: 24 * 60 * 60, // 24시간
} as const;
