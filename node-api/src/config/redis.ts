import { createClient, RedisClientType } from "redis";
import { env } from "./env";

/**
 * Two clients are created: the primary command client, plus a duplicated
 * subscriber used by the Socket.IO Redis adapter (pub/sub requires a
 * dedicated connection per role).
 */
export const redisClient: RedisClientType = createClient({ url: env.redisUrl });
export const redisSubClient: RedisClientType = redisClient.duplicate();

redisClient.on("error", (err) =>
  // eslint-disable-next-line no-console
  console.error("[redis] client error:", (err as Error).message)
);

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) await redisClient.connect();
  if (!redisSubClient.isOpen) await redisSubClient.connect();
  // eslint-disable-next-line no-console
  console.log("[redis] connected");
}

/** Cache helper: JSON get with graceful miss. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redisClient.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Cache helper: JSON set with TTL (seconds). */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
}
