import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { assertDbReady, pool } from "./config/db";
import { connectRedis, redisClient, redisSubClient } from "./config/redis";
import { initSocket, getIo } from "./config/socket";
import { runMigrations } from "./migrate";
import { startDeliveryMonitor } from "./services/connectivity.service";

/**
 * Boot sequence:
 *   1. Verify PostGIS connectivity.
 *   2. Connect Redis (command + subscriber).
 *   3. Create HTTP server + attach Socket.IO with the Redis adapter.
 *   4. Listen, and wire graceful shutdown.
 */
async function bootstrap(): Promise<void> {
  await assertDbReady();
  await runMigrations();
  await connectRedis();

  const app = createApp();
  const httpServer = http.createServer(app);

  initSocket(httpServer);
  // Automated delivery-delay alerts (requirement e): emits delivery:delayed.
  startDeliveryMonitor();

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[server] NER API listening on :${env.port} (env=${env.nodeEnv})`
    );
  });

  setupGracefulShutdown(httpServer);
}

function setupGracefulShutdown(httpServer: http.Server): void {
  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received — shutting down gracefully`);
    try {
      getIo().close();
    } catch {
      /* socket may not be initialized */
    }
    httpServer.close();
    await Promise.allSettled([
      pool.end(),
      redisClient.isOpen ? redisClient.quit() : Promise.resolve(),
      redisSubClient.isOpen ? redisSubClient.quit() : Promise.resolve(),
    ]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Last-resort guards so an unexpected throw never leaves a zombie process.
  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("[server] unhandledRejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    // eslint-disable-next-line no-console
    console.error("[server] uncaughtException:", err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[server] fatal boot error:", err);
  process.exit(1);
});
