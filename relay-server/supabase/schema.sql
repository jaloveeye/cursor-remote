-- Cursor Remote Relay Server - Supabase 스키마
-- Supabase Dashboard > SQL Editor에서 실행하세요.

-- 세션 (Redis session:* + sessions:list 역할)
CREATE TABLE IF NOT EXISTS relay_sessions (
  session_id TEXT PRIMARY KEY,
  pc_device_id TEXT,
  pc_last_seen_at BIGINT,
  pc_pin_hash TEXT,
  mobile_device_ids JSONB DEFAULT '[]',
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

-- 디바이스 → 세션 매핑 (Redis device:*:session)
CREATE TABLE IF NOT EXISTS relay_device_sessions (
  device_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES relay_sessions(session_id) ON DELETE CASCADE
);

-- 메시지 큐 (Redis List 대체, FIFO)
CREATE TABLE IF NOT EXISTS relay_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL,  -- 'mobile2pc' | 'pc2mobile' | 'pc2device'
  device_id TEXT,          -- pc2device 일 때 대상 모바일 device_id
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_relay_messages_session_direction
  ON relay_messages(session_id, direction, created_at);
CREATE INDEX IF NOT EXISTS idx_relay_messages_session_device
  ON relay_messages(session_id, direction, device_id, created_at);

-- 만료된 행 정리용 (선택: pg_cron 또는 Edge Function에서 주기 실행)
-- DELETE FROM relay_sessions WHERE expires_at < extract(epoch from now()) * 1000;
-- DELETE FROM relay_device_sessions WHERE expires_at < extract(epoch from now()) * 1000;
-- DELETE FROM relay_messages WHERE expires_at IS NOT NULL AND expires_at < extract(epoch from now()) * 1000;
