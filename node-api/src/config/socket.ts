import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisClient, redisSubClient } from "./redis";
import { env } from "./env";
import { verifyToken } from "../utils/auth";

/**
 * Singleton Socket.IO server. Emergency/hazard alerts are broadcast here so
 * dispatcher dashboards receive real-time push over WebSockets.
 */
let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  // Redis adapter lets alerts fan out across multiple API replicas.
  io.adapter(createAdapter(redisClient, redisSubClient));

  // Handshake auth: a supplied token MUST be valid (else the connection is
  // rejected); connections without a token are allowed as read-only "guests"
  // so the operator dashboards keep working. Set SOCKET_AUTH_REQUIRED=true to
  // require a token for every connection.
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (!token) {
      if (env.socketAuthRequired) return next(new Error("Authentication required"));
      socket.data.user = null;
      return next();
    }
    try {
      socket.data.user = verifyToken(token);
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] client connected: ${socket.id}`);

    // Dispatchers subscribe to a region room to scope alert traffic.
    socket.on("subscribe:region", (region: string) => {
      socket.join(`region:${region}`);
    });

    socket.on("disconnect", () => {
      // eslint-disable-next-line no-console
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/** Accessor guarded against use-before-init. */
export function getIo(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket() first.");
  }
  return io;
}

/** Convenience emitter for typed alert events. */
export function emitAlert(event: string, payload: unknown, region?: string): void {
  const server = getIo();
  if (region) {
    server.to(`region:${region}`).emit(event, payload);
  } else {
    server.emit(event, payload);
  }
}
