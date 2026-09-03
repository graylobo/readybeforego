export const CHAT_PERSIST_QUEUE = 'chat-persist';

export const CHAT_REDIS_KEYS = {
  recent: (room: string) => `chat:room:${room}:recent`,
  presence: (room: string) => `chat:room:${room}:presence`,
  rate: (identityKey: string) => `chat:rate:${identityKey}`,
  ipConn: (ip: string) => `chat:ipconn:${ip}`,
} as const;

export const PRESENCE_TTL_MS = 45_000;
export const PRESENCE_TOUCH_INTERVAL_MS = 20_000;
export const REDIS_HEALTH_INTERVAL_MS = 2_000;
export const GUEST_TOKEN_EXPIRES_SECONDS = 30 * 24 * 60 * 60;
