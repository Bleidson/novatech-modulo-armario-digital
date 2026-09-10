import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

// So conecta quando REDIS_URL esta definido de fato em uso - em dev/teste sem Core
// real, nada aqui tenta abrir socket nenhum (lazyConnect).
let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on("error", (err) => logger.error({ err }, "REDIS_CONNECTION_ERROR"));
  }
  return client;
}
