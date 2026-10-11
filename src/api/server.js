import crypto from "node:crypto";
import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { Server } from "socket.io";
import Identity from "./models/identity.js";
import Message from "./models/Message.js";
import Room from "./models/Room.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const IP_SALT = process.env.IP_SALT || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const MAX_TEXT = 500;
const MAX_HANDLE = 24;
const MAX_ROOM_NAME = 40;
const MAX_ROOM_DESC = 140;
const MAX_REACTION_KINDS = 20;
const MAX_ROOMS_PER_SOCKET = 3;
const MAX_CONNECTIONS_PER_IP = 20;
const MAX_ROOMS_PER_IP_PER_DAY = 3;
const MAX_ROOMS_TOTAL = 500;

const sha256 = (v) =>
  crypto.createHash("sha256").update(String(v)).digest("hex");

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const OID_RE = /^[a-f0-9]{24}$/i;
const EMOJI_RE =
  /^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;
const RESERVED_HANDLE_RE =
  /^(admin|mod|moderator|staff|support|rigidx|system|owner)/i;

const matches = (re, v) => typeof v === "string" && re.test(v);
const isOid = (v) => matches(OID_RE, v);
const isEmoji = (v) => matches(EMOJI_RE, v) && v.length <= 16;

const STRIP_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

const cleanText = (v) =>
  typeof v === "string"
    ? v
        .replace(STRIP_RE, "")
        .replace(/\r\n?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : "";

const cleanLine = (v, max) =>
  typeof v === "string"
    ? Array.from(v.replace(STRIP_RE, "").replace(/\s+/g, " ").trim())
        .slice(0, max)
        .join("")
    : "";

const randomHandle = () =>
  `anon-${crypto.randomBytes(3).toString("hex").slice(0, 4)}`;

const SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const suffix = (n) =>
  Array.from(
    { length: n },
    () => SUFFIX_CHARS[crypto.randomInt(SUFFIX_CHARS.length)],
  ).join("");

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "") || "room";

const ipHash = (ip) => sha256(`${ip}:${IP_SALT}`);

const ipOfReq = (req) => req.ip || req.socket.remoteAddress || "unknown";

const ipOfSocket = (socket) => {
  if (TRUST_PROXY) {
    const fwd = socket.handshake.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd) return fwd.split(",").at(-1).trim();
  }
  return socket.handshake.address || "unknown";
};

function createLimiter({ max, windowMs }) {
  const hits = new Map();

  setInterval(
    () => {
      const now = Date.now();
      for (const [key, stamps] of hits) {
        const recent = stamps.filter((t) => now - t < windowMs);
        if (recent.length) hits.set(key, recent);
        else hits.delete(key);
      }
    },
    Math.max(windowMs, 5000),
  ).unref();

  return {
    take(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

const limits = {
  send: createLimiter({ max: 5, windowMs: 10_000 }),
  sendByIp: createLimiter({ max: 30, windowMs: 10_000 }),
  react: createLimiter({ max: 30, windowMs: 10_000 }),
  edit: createLimiter({ max: 10, windowMs: 10_000 }),
  typing: createLimiter({ max: 10, windowMs: 5_000 }),
  join: createLimiter({ max: 10, windowMs: 10_000 }),
  report: createLimiter({ max: 10, windowMs: 60_000 }),
};

const GLOBAL_ROOM = {
  slug: "global",
  name: "Global",
  description: "Everyone, everywhere.",
  icon: null,
  visibility: "public",
};

const roomName = (slug) => `r:${slug}`;

function toPublicMessage(m) {
  const o = typeof m.toObject === "function" ? m.toObject() : m;
  return {
    _id: String(o._id),
    roomSlug: o.roomSlug ?? "global",
    text: o.text,
    authorId: o.authorId,
    handle: o.handle,
    clientId: o.clientId ?? null,
    reactions: o.reactions ?? {},
    createdAt: o.createdAt,
    editedAt: o.editedAt ?? null,
  };
}

function toPublicRoom(r) {
  return {
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    icon: r.icon || "💬",
    visibility: r.visibility,
    online: onlineCount(r.slug),
    lastMessageAt: r.lastMessageAt,
    createdAt: r.createdAt,
  };
}

const presence = new Map();
const dirtyRooms = new Set();
const connectionsByIp = new Map();

const onlineCount = (slug) => presence.get(slug)?.size ?? 0;

function presenceAdd(slug, authorId) {
  const room = presence.get(slug) ?? new Map();
  room.set(authorId, (room.get(authorId) ?? 0) + 1);
  presence.set(slug, room);
  dirtyRooms.add(slug);
}

function presenceRemove(slug, authorId) {
  const room = presence.get(slug);
  if (!room) return;
  const n = (room.get(authorId) ?? 1) - 1;
  if (n <= 0) room.delete(authorId);
  else room.set(authorId, n);
  if (room.size === 0) presence.delete(slug);
  dirtyRooms.add(slug);
}

const app = express();
const httpServer = http.createServer(app);

if (TRUST_PROXY) app.set("trust proxy", 1);
app.disable("x-powered-by");

const io = new Server(httpServer, {
  cors: { origin: ORIGINS },
  maxHttpBufferSize: 16 * 1024,
  serveClient: false,
});

app.use(helmet());
app.use(
  cors({
    origin: ORIGINS,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Owner-Key", "Authorization"],
  }),
);
app.use(express.json({ limit: "20kb" }));

const jsonLimiter = (opts) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
    ...opts,
  });

app.use("/api", jsonLimiter({ windowMs: 60_000, limit: 120 }));

const chatLimiter = jsonLimiter({ windowMs: 60_000, limit: 20 });
const createRoomLimiter = jsonLimiter({ windowMs: 60_000, limit: 5 });
const ownerLimiter = jsonLimiter({ windowMs: 60_000, limit: 30 });

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message, history = [] } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (item) =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string",
          )
          .slice(-20)
          .map((item) => ({
            role: item.role,
            content: item.content.slice(0, 2000),
          }))
      : [];

    const messages = [
      {
        role: "system",
        content: `
You are a random stranger chatting on RigidX.

Talk casually like a normal person texting.
- Keep replies short, usually 1 sentence.
- Match the user's language and vibe.
- English, Hindi, Marathi, Hinglish and slang are fine.
- Be casual, spontaneous and playful.
- Don't ask a question every time.
- Don't overthink simple messages.
- Don't give explanations.
- Remember the conversation naturally.
- Use emojis occasionally.
- Reply only with the message you would send.
`,
      },
      ...safeHistory,
      { role: "user", content: message.trim().slice(0, MAX_TEXT) },
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages,
          temperature: 0.8,
          max_tokens: 150,
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      console.error(
        `Groq error: ${response.status} - ${await response.text()}`,
      );
      return res.status(502).json({ error: "AI provider error" });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("Empty Groq response:", data);
      return res.status(502).json({ error: "Empty AI response" });
    }

    return res.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    if (error.name === "TimeoutError") {
      return res.status(504).json({ error: "AI request timed out" });
    }
    return res.status(500).json({ error: "Failed to get response" });
  }
});

app.get("/api/messages", async (req, res) => {
  try {
    const room = req.query.room ?? "global";
    const { before, after } = req.query;

    if (!matches(SLUG_RE, room))
      return res.status(400).json({ error: "Invalid room" });
    if (before && after) {
      return res
        .status(400)
        .json({ error: "Use either before or after, not both" });
    }
    if ((before && !isOid(before)) || (after && !isOid(after))) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    if (
      room !== "global" &&
      !(await Room.exists({ slug: room, deletedAt: null }))
    ) {
      return res.status(404).json({ error: "Room not found" });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100,
    );

    if (after) {
      const docs = await Message.find({ roomSlug: room, _id: { $gt: after } })
        .sort({ _id: 1 })
        .limit(limit + 1)
        .lean();
      const hasMore = docs.length > limit;
      if (hasMore) docs.pop();
      return res.json({ messages: docs.map(toPublicMessage), hasMore });
    }

    const filter = { roomSlug: room };
    if (before) filter._id = { $lt: before };

    const docs = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = docs.length > limit;
    if (hasMore) docs.pop();

    return res.json({ messages: docs.reverse().map(toPublicMessage), hasMore });
  } catch (error) {
    console.error("History error:", error);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

app.post("/api/rooms", createRoomLimiter, async (req, res) => {
  try {
    const name = cleanLine(req.body?.name, MAX_ROOM_NAME);
    const description = cleanLine(req.body?.description, MAX_ROOM_DESC);
    const icon = isEmoji(req.body?.icon) ? req.body.icon : "💬";
    const visibility =
      req.body?.visibility === "private" ? "private" : "public";

    if (name.length < 2) {
      return res
        .status(400)
        .json({ error: "Room names need at least 2 characters." });
    }

    const creator = ipHash(ipOfReq(req));
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (
      (await Room.countDocuments({
        creatorIpHash: creator,
        createdAt: { $gte: since },
      })) >= MAX_ROOMS_PER_IP_PER_DAY
    ) {
      return res.status(429).json({
        error: "You've reached today's room limit. Try again tomorrow.",
      });
    }
    if ((await Room.countDocuments({ deletedAt: null })) >= MAX_ROOMS_TOTAL) {
      return res
        .status(503)
        .json({ error: "Room creation is paused for now." });
    }

    const ownerKey = crypto.randomBytes(24).toString("base64url");
    const base = slugify(name);
    const tail = visibility === "private" ? 10 : 5;

    let room = null;
    for (let i = 0; i < 4 && !room; i++) {
      try {
        room = await Room.create({
          slug: `${base}-${suffix(tail)}`,
          name,
          description,
          icon,
          visibility,
          ownerKeyHash: sha256(ownerKey),
          creatorIpHash: creator,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    if (!room)
      return res
        .status(500)
        .json({ error: "Couldn't create the room. Try again." });

    return res.status(201).json({ room: toPublicRoom(room), ownerKey });
  } catch (error) {
    console.error("Create room error:", error);
    return res.status(500).json({ error: "Couldn't create the room." });
  }
});

app.get("/api/rooms", async (_req, res) => {
  try {
    const rooms = await Room.find({ visibility: "public", deletedAt: null })
      .sort({ lastMessageAt: -1 })
      .limit(30)
      .lean();
    return res.json({ rooms: rooms.map(toPublicRoom) });
  } catch (error) {
    console.error("List rooms error:", error);
    return res.status(500).json({ error: "Failed to load rooms" });
  }
});

app.get("/api/rooms/:slug", async (req, res) => {
  try {
    if (!matches(SLUG_RE, req.params.slug))
      return res.status(404).json({ error: "Room not found" });
    const room = await Room.findOne({
      slug: req.params.slug,
      deletedAt: null,
    }).lean();
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.json({ room: toPublicRoom(room) });
  } catch (error) {
    console.error("Get room error:", error);
    return res.status(500).json({ error: "Failed to load room" });
  }
});

async function loadOwnedRoom(req, res) {
  const { slug } = req.params;
  if (!matches(SLUG_RE, slug)) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  const room = await Room.findOne({ slug, deletedAt: null }).select(
    "+ownerKeyHash",
  );
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  if (!safeEqual(room.ownerKeyHash, sha256(req.get("x-owner-key") ?? ""))) {
    res.status(403).json({ error: "That owner key doesn't match this room." });
    return null;
  }
  return room;
}

app.patch("/api/rooms/:slug", ownerLimiter, async (req, res) => {
  try {
    const room = await loadOwnedRoom(req, res);
    if (!room) return;

    const name = cleanLine(req.body?.name, MAX_ROOM_NAME);
    if (typeof req.body?.name === "string") {
      if (name.length < 2)
        return res
          .status(400)
          .json({ error: "Room names need at least 2 characters." });
      room.name = name;
    }
    if (typeof req.body?.description === "string") {
      room.description = cleanLine(req.body.description, MAX_ROOM_DESC);
    }
    if (isEmoji(req.body?.icon)) room.icon = req.body.icon;

    await room.save();
    const pub = toPublicRoom(room);
    io.to(roomName(room.slug)).emit("room:updated", pub);
    return res.json({ room: pub });
  } catch (error) {
    console.error("Update room error:", error);
    return res.status(500).json({ error: "Couldn't save changes." });
  }
});

function closeRoom(slug) {
  const name = roomName(slug);
  io.to(name).emit("room:deleted", { slug });
  io.in(name).socketsLeave(name);
  presence.delete(slug);
}

app.delete("/api/rooms/:slug", ownerLimiter, async (req, res) => {
  try {
    const room = await loadOwnedRoom(req, res);
    if (!room) return;
    room.deletedAt = new Date();
    await room.save();
    closeRoom(room.slug);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete room error:", error);
    return res.status(500).json({ error: "Couldn't delete the room." });
  }
});

app.delete("/api/rooms/:slug/messages/:id", ownerLimiter, async (req, res) => {
  try {
    if (!isOid(req.params.id))
      return res.status(400).json({ error: "Invalid message" });
    const room = await loadOwnedRoom(req, res);
    if (!room) return;

    const deleted = await Message.findOneAndDelete({
      _id: req.params.id,
      roomSlug: room.slug,
    });
    if (!deleted) return res.status(404).json({ error: "Message not found" });

    io.to(roomName(room.slug)).emit("message:deleted", {
      slug: room.slug,
      messageId: String(deleted._id),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Remove message error:", error);
    return res.status(500).json({ error: "Couldn't remove the message." });
  }
});

function adminOnly(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found" });
  const token = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(sha256(token), sha256(ADMIN_TOKEN))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/api/admin/reports", adminOnly, ownerLimiter, async (_req, res) => {
  const [rooms, messages] = await Promise.all([
    Room.find({ reportCount: { $gt: 0 }, deletedAt: null })
      .sort({ reportCount: -1 })
      .limit(50)
      .select("slug name description visibility reportCount createdAt")
      .lean(),
    Message.find({ reportCount: { $gt: 0 } })
      .sort({ reportCount: -1 })
      .limit(50)
      .select("roomSlug text authorId handle reportCount createdAt")
      .lean(),
  ]);
  res.json({ rooms, messages });
});

app.delete(
  "/api/admin/rooms/:slug",
  adminOnly,
  ownerLimiter,
  async (req, res) => {
    if (!matches(SLUG_RE, req.params.slug))
      return res.status(404).json({ error: "Room not found" });
    const r = await Room.updateOne(
      { slug: req.params.slug, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (!r.matchedCount)
      return res.status(404).json({ error: "Room not found" });
    closeRoom(req.params.slug);
    return res.json({ ok: true });
  },
);

app.delete(
  "/api/admin/messages/:id",
  adminOnly,
  ownerLimiter,
  async (req, res) => {
    if (!isOid(req.params.id))
      return res.status(400).json({ error: "Invalid message" });
    const deleted = await Message.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Message not found" });
    io.to(roomName(deleted.roomSlug)).emit("message:deleted", {
      slug: deleted.roomSlug,
      messageId: String(deleted._id),
    });
    return res.json({ ok: true });
  },
);

io.use(async (socket, next) => {
  try {
    const ip = ipOfSocket(socket);
    if ((connectionsByIp.get(ip) ?? 0) >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error("too_many_connections"));
    }

    const auth = socket.handshake.auth ?? {};
    if (!matches(ID_RE, auth.authorId) || !matches(SECRET_RE, auth.secret)) {
      return next(new Error("bad_auth"));
    }

    const secretHash = sha256(auth.secret);
    let identity = await Identity.findOne({ authorId: auth.authorId }).lean();

    if (!identity) {
      if (await Message.exists({ authorId: auth.authorId })) {
        return next(new Error("identity_conflict"));
      }
      const wanted = cleanLine(auth.handle, MAX_HANDLE);
      const handle =
        wanted && !RESERVED_HANDLE_RE.test(wanted) ? wanted : randomHandle();
      identity = await Identity.findOneAndUpdate(
        { authorId: auth.authorId },
        { $setOnInsert: { secretHash, handle } },
        { upsert: true, new: true },
      ).lean();
    }

    if (!safeEqual(identity.secretHash, secretHash)) {
      return next(new Error("identity_conflict"));
    }

    socket.data.authorId = identity.authorId;
    socket.data.handle = identity.handle;
    socket.data.ip = ip;
    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return next(new Error("server_error"));
  }
});

const lastTouch = new Map();
function touchRoom(slug) {
  if (slug === "global") return;
  const now = Date.now();
  if (now - (lastTouch.get(slug) ?? 0) < 10_000) return;
  lastTouch.set(slug, now);
  Room.updateOne({ slug }, { $set: { lastMessageAt: new Date() } }).catch(
    () => {},
  );
}

io.on("connection", (socket) => {
  const { authorId, handle, ip } = socket.data;

  connectionsByIp.set(ip, (connectionsByIp.get(ip) ?? 0) + 1);
  socket.emit("session", { authorId, handle });

  const inRoom = (slug) =>
    matches(SLUG_RE, slug) && socket.rooms.has(roomName(slug));

  const on = (event, handler) =>
    socket.on(event, async (payload, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      try {
        await handler(
          payload && typeof payload === "object" ? payload : {},
          respond,
        );
      } catch (error) {
        console.error(`${event} error:`, error);
        respond({ ok: false, error: "Something went wrong" });
      }
    });

  on("room:join", async ({ slug }, respond) => {
    if (!matches(SLUG_RE, slug))
      return respond({ ok: false, error: "Invalid room" });
    if (!limits.join.take(socket.id))
      return respond({ ok: false, error: "Slow down a little" });

    let room = null;
    if (slug !== "global") {
      room = await Room.findOne({ slug, deletedAt: null }).lean();
      if (!room)
        return respond({
          ok: false,
          code: "not_found",
          error: "Room not found",
        });
    }

    const name = roomName(slug);
    if (!socket.rooms.has(name)) {
      const open = [...socket.rooms].filter((r) => r.startsWith("r:")).length;
      if (open >= MAX_ROOMS_PER_SOCKET) {
        return respond({
          ok: false,
          code: "too_many",
          error: "Too many rooms open",
        });
      }
      await socket.join(name);
      presenceAdd(slug, authorId);
    }

    return respond({
      ok: true,
      room: room ? toPublicRoom(room) : GLOBAL_ROOM,
      online: onlineCount(slug),
    });
  });

  on("room:leave", ({ slug }) => {
    if (!matches(SLUG_RE, slug) || !socket.rooms.has(roomName(slug))) return;
    socket.leave(roomName(slug));
    presenceRemove(slug, authorId);
  });

  on("message:send", async ({ slug, clientId, text: rawText }, respond) => {
    if (!inRoom(slug))
      return respond({ ok: false, error: "Join the room first" });

    const text = cleanText(rawText);
    if (!text || text.length > MAX_TEXT) {
      return respond({
        ok: false,
        error: `Messages must be 1 to ${MAX_TEXT} characters`,
      });
    }
    if (!limits.send.take(socket.id) || !limits.sendByIp.take(ip)) {
      return respond({ ok: false, error: "You're sending messages too fast" });
    }

    const cid = matches(ID_RE, clientId) ? clientId : null;

    try {
      const doc = await Message.create({
        roomSlug: slug,
        text,
        authorId,
        handle,
        clientId: cid ?? undefined,
        reactions: {},
      });
      const message = toPublicMessage(doc);
      io.to(roomName(slug)).emit("message:new", message);
      touchRoom(slug);
      return respond({ ok: true, message });
    } catch (error) {
      if (error?.code === 11000 && cid) {
        const existing = await Message.findOne({
          authorId,
          clientId: cid,
        }).lean();
        if (existing)
          return respond({
            ok: true,
            message: toPublicMessage(existing),
            duplicate: true,
          });
      }
      throw error;
    }
  });

  on("message:edit", async ({ slug, messageId, text: rawText }, respond) => {
    if (!inRoom(slug) || !isOid(messageId))
      return respond({ ok: false, error: "Invalid edit request" });
    if (!limits.edit.take(socket.id))
      return respond({ ok: false, error: "You're editing too fast" });

    const text = cleanText(rawText);
    if (!text || text.length > MAX_TEXT) {
      return respond({
        ok: false,
        error: `Messages must be 1 to ${MAX_TEXT} characters`,
      });
    }

    const updated = await Message.findOneAndUpdate(
      { _id: messageId, roomSlug: slug, authorId },
      { $set: { text, editedAt: new Date() } },
      { new: true },
    ).lean();

    if (!updated)
      return respond({
        ok: false,
        error: "You can only edit your own messages",
      });

    const message = toPublicMessage(updated);
    io.to(roomName(slug)).emit("message:updated", { message });
    return respond({ ok: true, message });
  });

  on("message:delete", async ({ slug, messageId }, respond) => {
    if (!inRoom(slug) || !isOid(messageId))
      return respond({ ok: false, error: "Invalid delete request" });
    if (!limits.edit.take(socket.id))
      return respond({ ok: false, error: "You're deleting too fast" });

    const deleted = await Message.findOneAndDelete({
      _id: messageId,
      roomSlug: slug,
      authorId,
    });
    if (!deleted)
      return respond({
        ok: false,
        error: "You can only delete your own messages",
      });

    io.to(roomName(slug)).emit("message:deleted", {
      slug,
      messageId: String(deleted._id),
    });
    return respond({ ok: true, messageId: String(deleted._id) });
  });

  on("message:reaction", async ({ slug, messageId, emoji }, respond) => {
    if (!inRoom(slug) || !isOid(messageId) || !isEmoji(emoji)) {
      return respond({ ok: false, error: "Invalid reaction" });
    }
    if (!limits.react.take(socket.id))
      return respond({ ok: false, error: "You're reacting too fast" });

    const base = { _id: messageId, roomSlug: slug };
    const path = `reactions.${emoji}`;

    const current = await Message.findOne(base).select("reactions").lean();
    if (!current) return respond({ ok: false, error: "Message not found" });

    const kinds = Object.keys(current.reactions ?? {});
    if (!kinds.includes(emoji) && kinds.length >= MAX_REACTION_KINDS) {
      return respond({
        ok: false,
        error: "This message has too many different reactions",
      });
    }

    let doc = await Message.findOneAndUpdate(
      { ...base, [path]: { $ne: authorId } },
      { $addToSet: { [path]: authorId } },
      { new: true },
    ).lean();

    if (!doc) {
      doc = await Message.findOneAndUpdate(
        { ...base, [path]: authorId },
        { $pull: { [path]: authorId } },
        { new: true },
      ).lean();

      if (
        doc &&
        Array.isArray(doc.reactions?.[emoji]) &&
        doc.reactions[emoji].length === 0
      ) {
        await Message.updateOne(
          { ...base, [path]: { $size: 0 } },
          { $unset: { [path]: "" } },
        );
        delete doc.reactions[emoji];
      }
    }

    if (!doc) return respond({ ok: false, error: "Message not found" });

    const message = {
      _id: String(doc._id),
      roomSlug: slug,
      reactions: doc.reactions ?? {},
    };
    io.to(roomName(slug)).emit("message:reaction:update", { message });
    return respond({ ok: true, message });
  });

  on("typing", ({ slug, isTyping }) => {
    if (!inRoom(slug) || !limits.typing.take(socket.id)) return;
    socket.to(roomName(slug)).emit("typing:update", {
      slug,
      authorId,
      handle,
      isTyping: Boolean(isTyping),
    });
  });

  on("message:report", async ({ slug, messageId }, respond) => {
    if (!inRoom(slug) || !isOid(messageId))
      return respond({ ok: false, error: "Invalid report" });
    if (!limits.report.take(socket.id))
      return respond({ ok: false, error: "Too many reports. Try again soon." });

    await Message.updateOne(
      {
        _id: messageId,
        roomSlug: slug,
        authorId: { $ne: authorId },
        reportedBy: { $ne: authorId },
      },
      { $addToSet: { reportedBy: authorId }, $inc: { reportCount: 1 } },
    );
    return respond({ ok: true });
  });

  on("room:report", async ({ slug }, respond) => {
    if (!inRoom(slug) || slug === "global")
      return respond({ ok: false, error: "Invalid report" });
    if (!limits.report.take(socket.id))
      return respond({ ok: false, error: "Too many reports. Try again soon." });

    await Room.updateOne(
      { slug, deletedAt: null, reportedBy: { $ne: authorId } },
      { $addToSet: { reportedBy: authorId }, $inc: { reportCount: 1 } },
    );
    return respond({ ok: true });
  });

  socket.on("disconnecting", () => {
    for (const name of socket.rooms) {
      if (name.startsWith("r:")) presenceRemove(name.slice(2), authorId);
    }
  });

  socket.on("disconnect", () => {
    const n = (connectionsByIp.get(ip) ?? 1) - 1;
    if (n <= 0) connectionsByIp.delete(ip);
    else connectionsByIp.set(ip, n);
  });
});

setInterval(() => {
  for (const slug of dirtyRooms) {
    io.to(roomName(slug)).emit("presence:count", {
      slug,
      count: onlineCount(slug),
    });
  }
  dirtyRooms.clear();
}, 1000).unref();

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON" });
  if (error?.type === "entity.too.large")
    return res.status(413).json({ error: "Request too large" });
  console.error("Unhandled error:", error);
  return res.status(500).json({ error: "Something went wrong" });
});

async function start() {
  if (!process.env.MONGODB_URI)
    throw new Error("MONGODB_URI is missing from the environment");
  if (IS_PROD && !IP_SALT) throw new Error("IP_SALT is required in production");
  if (IS_PROD && ADMIN_TOKEN && ADMIN_TOKEN.length < 24)
    throw new Error("ADMIN_TOKEN is too short");

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log("MongoDB connected");

  await Promise.all([Message.init(), Room.init(), Identity.init()]);

  const migrated = await Message.updateMany(
    { roomSlug: { $exists: false } },
    { $set: { roomSlug: "global" } },
  );
  if (migrated.modifiedCount)
    console.log(`Moved ${migrated.modifiedCount} old messages into Global`);

  httpServer.listen(PORT, "0.0.0.0", () =>
    console.log(`rigidX server running on port ${PORT}`),
  );
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  io.close(() => {
    httpServer.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) =>
  console.error("Unhandled rejection:", reason),
);

start().catch((error) => {
  console.error("Startup failed:", error);
  process.exit(1);
});
