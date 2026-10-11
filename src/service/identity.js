const KEY = "rigidx-identity";

const hex = (bytes) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

const uuid = () =>
  crypto.randomUUID?.() ?? `${hex(4)}-${hex(2)}-${hex(2)}-${hex(2)}-${hex(6)}`;

const randomHandle = () => `anon-${Math.random().toString(36).slice(2, 6)}`;

function persist(identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {}
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.authorId && saved?.handle) {
      const identity = { ...saved, secret: saved.secret || hex(32) };
      if (!saved.secret) persist(identity);
      return identity;
    }
  } catch {}

  const identity = {
    authorId: uuid(),
    secret: hex(32),
    handle: randomHandle(),
  };
  persist(identity);
  return identity;
}

let full = load();
let snapshot = { authorId: full.authorId, handle: full.handle };
const listeners = new Set();

const publish = () => {
  snapshot = { authorId: full.authorId, handle: full.handle };
  listeners.forEach((fn) => fn());
};

export const getIdentity = () => snapshot;

export const subscribeIdentity = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getAuth = () => ({
  authorId: full.authorId,
  secret: full.secret,
  handle: full.handle,
});

export function adoptHandle(handle) {
  if (typeof handle !== "string" || !handle || handle === full.handle) return;
  full = { ...full, handle };
  persist(full);
  publish();
}

export function rotateIdentity() {
  full = { authorId: uuid(), secret: hex(32), handle: randomHandle() };
  persist(full);
  publish();
}
