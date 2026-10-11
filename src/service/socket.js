import { io } from "socket.io-client";
import { adoptHandle, getAuth, rotateIdentity } from "./identity";

const API_BASE = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3000" : "")
).replace(/\/$/, "");

export const socket = io(API_BASE || undefined, {
  autoConnect: false,
  auth: (cb) => cb(getAuth()),
  reconnectionDelayMax: 8000,
});

let wanted = false;
let rotations = 0;
let retryTimer = null;

export function openSocket() {
  wanted = true;
  if (!socket.connected && !socket.active) socket.connect();
  else if (!socket.connected) socket.connect();
}

export function closeSocket() {
  wanted = false;
  clearTimeout(retryTimer);
  socket.disconnect();
}

socket.on("session", (s) => {
  if (s?.handle) adoptHandle(s.handle);
});

socket.on("connect", () => {
  rotations = 0;
});

socket.on("connect_error", (err) => {
  if (!wanted || socket.active) return;

  const code = err?.message;
  if ((code === "identity_conflict" || code === "bad_auth") && rotations < 2) {
    rotations += 1;
    rotateIdentity();
    socket.connect();
    return;
  }

  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (wanted && !socket.connected) socket.connect();
  }, 3000);
});

export { API_BASE };
