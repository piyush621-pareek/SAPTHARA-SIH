import { io, Socket } from "socket.io-client";

// Socket.IO connects directly to the backend origin (the WebSocket upgrade does
// not go through the Vite proxy). Override with VITE_SOCKET_URL if hosted.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "http://localhost:8080";

export function createSocket(): Socket {
  return io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
  });
}
