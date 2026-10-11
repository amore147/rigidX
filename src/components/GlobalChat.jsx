import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { socket, openSocket, closeSocket, API_BASE } from "../service/socket";
import { getIdentity, subscribeIdentity } from "../service/identity";

const EmojiPicker = React.lazy(() => import("emoji-picker-react"));

/* ───────────────────────────── constants ───────────────────────────── */

const PAGE = 50;
const MAX = 500; // must match MAX_TEXT on the server
const GROUP_MS = 5 * 60 * 1000;
const SEND_GAP = 400;
const ACK_TIMEOUT = 8000;
const THEME_KEY = "rigidx-theme";
const ROOMS_KEY = "rigidx-rooms";
const OWNER_KEYS_KEY = "rigidx-owner-keys";
const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const ROOM_ICONS = [
  "💬",
  "🎮",
  "🎵",
  "📚",
  "💻",
  "🎨",
  "⚽",
  "🍜",
  "🌱",
  "🚀",
  "🎬",
  "✨",
];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const NONE = new Set();

const GLOBAL = {
  slug: "global",
  name: "Global",
  description: "Everyone, everywhere.",
  icon: null,
  visibility: "public",
};

const FINISHES = {
  spaceBlack: { name: "Space Black", bubble: "#f5f5f7", ink: "#1d1d1f" },
  deepSlate: { name: "Deep Slate", bubble: "#0a84ff", ink: "#ffffff" },
  graphite: { name: "Graphite", bubble: "#636366", ink: "#ffffff" },
  titanium: { name: "Titanium", bubble: "#c9c4ba", ink: "#1d1d1f" },
};

const TINTS = [
  "#0a84ff",
  "#30d158",
  "#ff9f0a",
  "#bf5af2",
  "#ff375f",
  "#64d2ff",
  "#ffd60a",
  "#ac8e68",
];

/* ───────────────────────────── helpers ───────────────────────────── */

const hash = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const normalize = (m) => ({ ...m, t: Date.parse(m.createdAt) || Date.now() });

const sameDay = (a, b) => a.toDateString() === b.toDateString();

const dayLabel = (d) => {
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
};

const timeLabel = (d) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

const loadRooms = () => {
  const saved = readJSON(ROOMS_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter(
      (r) =>
        r &&
        typeof r.slug === "string" &&
        SLUG_RE.test(r.slug) &&
        r.slug !== "global",
    )
    .slice(0, 30)
    .map((r) => ({
      slug: r.slug,
      name: String(r.name ?? r.slug).slice(0, 40),
      icon: typeof r.icon === "string" && r.icon ? r.icon : "💬",
      description: String(r.description ?? "").slice(0, 140),
      visibility: r.visibility === "private" ? "private" : "public",
    }));
};

// Accepts a bare slug, "/c/slug" or a full invite link.
function parseSlug(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/\/c\/([a-z0-9-]+)/i);
  const slug = (m ? m[1] : s).toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

const inviteLink = (slug) => `${window.location.origin}/c/${slug}`;

const newClientId = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall back to a hidden textarea */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mergeMessages(prev, incoming) {
  const seenId = new Set();
  const seenClient = new Set();
  const out = [];

  // Incoming first: the server's version of a message wins over our optimistic copy.
  for (const m of [...incoming, ...prev]) {
    if (m._id && seenId.has(m._id)) continue;
    if (m.clientId && seenClient.has(m.clientId)) continue;
    if (m._id) seenId.add(m._id);
    if (m.clientId) seenClient.add(m.clientId);
    out.push(m);
  }

  return out.sort(
    (a, b) =>
      a.t - b.t ||
      ((a._id ?? "") < (b._id ?? "")
        ? -1
        : (a._id ?? "") > (b._id ?? "")
          ? 1
          : 0),
  );
}

function placePopover(a, w, h) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = 8;
  const G = 8;

  let above = true;
  let top = a.top - h - G;

  if (top < M) {
    top = a.bottom + G;
    above = false;
  }
  if (top + h > vh - M) top = Math.max(M, vh - h - M);

  const left = Math.min(
    Math.max(M, a.left + a.width / 2 - w / 2),
    Math.max(M, vw - w - M),
  );
  return { top, left, above };
}

/* ───────────────────────────── small pieces ───────────────────────────── */

const ICONS = {
  plus: ["M8 3v10", "M3 8h10"],
  close: ["M4 4l8 8", "M12 4l-8 8"],
  info: ["M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z", "M8 7.4v3.6", "M8 5.1v.01"],
  globe: [
    "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z",
    "M2 8h12",
    "M8 2c1.8 1.7 2.7 3.7 2.7 6S9.8 12.3 8 14c-1.8-1.7-2.7-3.7-2.7-6S6.2 3.7 8 2z",
  ],
  pencil: ["M10.6 3.4l2 2L6 12l-2.8.8L4 10z"],
  trash: ["M3 4.5h10", "M6.3 4.5V3h3.4v1.5", "M4.5 4.5l.5 8.5h6l.5-8.5"],
  flag: ["M4 14V2.8", "M4 3.4h7.2L9.8 6l1.4 2.6H4"],
  copy: ["M5.5 5.5h7v8h-7z", "M3.5 10.5v-8h7"],
  link: [
    "M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6",
    "M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6",
  ],
  lock: ["M4.5 7.5h7v5.5h-7z", "M6 7.5V5.5a2 2 0 0 1 4 0v2"],
  check: ["M3 8.5l3.2 3.2L13 4.5"],
  download: ["M8 2.5v8", "M4.8 7.6L8 10.8l3.2-3.2", "M3 13.2h10"],
};

function Ico({ name, size = 16, sw = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {ICONS[name].map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function Spinner() {
  return (
    <span className="gc-spin" role="status" aria-label="Loading">
      {Array.from({ length: 12 }, (_, i) => (
        <i
          key={i}
          style={{
            transform: `rotate(${i * 30}deg)`,
            animationDelay: `${-(1 - i / 12)}s`,
          }}
        />
      ))}
    </span>
  );
}

function Avatar({ id, handle }) {
  const tint = TINTS[hash(id) % TINTS.length];
  const letter = (handle.replace(/^anon-/, "")[0] || "?").toUpperCase();
  return (
    <span className="gc-av" style={{ "--tint": tint }} aria-hidden="true">
      {letter}
    </span>
  );
}

/* ───────────────────────────── message row ───────────────────────────── */

const Row = React.memo(function Row({
  m,
  first,
  last,
  mine,
  fresh,
  pickerActive,
  editing,
  onRetry,
  onDiscard,
  onReact,
  onOpenPicker,
  onEditSave,
  onEditCancel,
  me,
  canReact,
}) {
  const addRef = useRef(null);
  const [editText, setEditText] = useState(m.text);

  useEffect(() => {
    if (!editing) setEditText(m.text);
  }, [m.text, editing]);

  const failed = m.status === "failed";
  const sending = m.status === "sending";
  const reactable = Boolean(m._id) && !sending && !failed;

  const reactions = Object.entries(m.reactions || {}).filter(
    ([, users]) => Array.isArray(users) && users.length > 0,
  );

  const save = () => onEditSave(m, editText);

  return (
    <div
      className={`gc-row${mine ? " mine" : ""}${first ? " first" : ""}${last ? " last" : ""}`}
    >
      {!mine && (
        <div className="gc-av-slot">
          {last && <Avatar id={m.authorId || ""} handle={m.handle || "?"} />}
        </div>
      )}

      <div className="gc-col">
        {!mine && first && <div className="gc-name">{m.handle}</div>}

        <div className="gc-line">
          <div
            className={`gc-bubble${fresh ? " fresh" : ""}${sending ? " sending" : ""}`}
            title={new Date(m.t).toLocaleString()}
          >
            {editing ? (
              <textarea
                className="gc-edit-input"
                value={editText}
                maxLength={MAX}
                autoFocus
                aria-label="Edit message"
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    save();
                  }
                }}
              />
            ) : (
              m.text
            )}
          </div>

          {reactable && !editing && (
            <button
              ref={addRef}
              type="button"
              className="gc-addr"
              aria-label="Reactions and actions"
              aria-haspopup="dialog"
              aria-expanded={pickerActive}
              onClick={() => onOpenPicker(m._id, addRef.current)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="7"
                  cy="8.5"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <circle cx="5.2" cy="7.4" r=".75" fill="currentColor" />
                <circle cx="8.8" cy="7.4" r=".75" fill="currentColor" />
                <path
                  d="M4.9 9.8c.5.8 1.2 1.2 2.1 1.2s1.6-.4 2.1-1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <path
                  d="M12.6 1.6v3.2M11 3.2h3.2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {editing && (
          <div className="gc-own-actions">
            <button type="button" onClick={save}>
              Save
            </button>
            <button type="button" onClick={onEditCancel}>
              Cancel
            </button>
          </div>
        )}

        {reactable && reactions.length > 0 && (
          <div className="gc-chips" role="group" aria-label="Reactions">
            {reactions.map(([emoji, users]) => {
              const on = users.includes(me.authorId);
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`gc-chip${on ? " on" : ""}`}
                  disabled={!canReact}
                  aria-pressed={on}
                  aria-label={`${emoji} ${users.length} ${users.length === 1 ? "reaction" : "reactions"}${
                    on ? ", including yours" : ""
                  }`}
                  onClick={() => onReact(m._id, emoji)}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span className="gc-chip-n" aria-hidden="true">
                    {users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {(last || failed || m.editedAt) && !editing && (
          <div
            className={`gc-meta${failed ? " bad" : ""}`}
            title={failed ? m.error : undefined}
          >
            {failed ? (
              <>
                Not delivered
                <button type="button" onClick={() => onRetry(m)}>
                  Retry
                </button>
                <button type="button" onClick={() => onDiscard(m)}>
                  Discard
                </button>
              </>
            ) : sending ? (
              "Sending"
            ) : (
              <>
                {m.editedAt && "Edited"}
                {m.editedAt && last && " · "}
                {last && timeLabel(new Date(m.t))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* ───────────────────────────── reactions + actions popover ───────────────────────────── */

function ReactionPopover({
  anchorEl,
  listEl,
  selected,
  canReact,
  actions,
  onPick,
  onAction,
  onClose,
}) {
  const [full, setFull] = useState(false);
  const [, tick] = useReducer((n) => n + 1, 0);
  const ref = useRef(null);
  const sheet = full && window.innerWidth <= 520;

  const reposition = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    if (!sheet && anchorEl?.isConnected) {
      const { top, left, above } = placePopover(
        anchorEl.getBoundingClientRect(),
        el.offsetWidth,
        el.offsetHeight,
      );
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.transformOrigin = above ? "bottom center" : "top center";
    }

    void el.offsetWidth;
    el.dataset.ready = "1";
  }, [anchorEl, sheet]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, full]);

  useEffect(() => {
    const onResize = () => {
      tick();
      reposition();
    };
    listEl?.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      listEl?.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", onResize);
    };
  }, [listEl, reposition]);

  useEffect(() => {
    ref.current
      ?.querySelector(
        ".gc-q-btn:not(:disabled), .gc-menu button:not(:disabled)",
      )
      ?.focus({ preventScroll: true });
  }, []);

  const picker = useMemo(() => {
    const touch = window.matchMedia?.("(hover: none)").matches;
    return (
      <Suspense
        fallback={
          <div className="gc-full-load">
            <Spinner />
          </div>
        }
      >
        <EmojiPicker
          onEmojiClick={(d) => onPick(d.emoji)}
          theme="dark"
          emojiStyle="native"
          width="100%"
          height="100%"
          lazyLoadEmojis
          autoFocusSearch={!touch}
          searchPlaceHolder="Search emoji"
          previewConfig={{ showPreview: false }}
        />
      </Suspense>
    );
  }, [onPick]);

  const onKeyDown = (e) => {
    const root = ref.current;
    if (!root) return;
    const btns = [...root.querySelectorAll("button:not(:disabled)")];
    const i = btns.indexOf(document.activeElement);

    if (e.key === "Tab" && btns.length) {
      e.preventDefault();
      const step = e.shiftKey ? -1 : 1;
      btns[(i + step + btns.length) % btns.length].focus();
      return;
    }

    const inBar = document.activeElement?.closest?.(".gc-q");
    const inMenu = document.activeElement?.closest?.(".gc-menu");
    const move = (list, step) => {
      const k = list.indexOf(document.activeElement);
      if (k < 0) return;
      e.preventDefault();
      list[(k + step + list.length) % list.length].focus();
    };

    if (inBar && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      move(
        [...inBar.querySelectorAll("button:not(:disabled)")],
        e.key === "ArrowRight" ? 1 : -1,
      );
    } else if (inMenu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      move(
        [...inMenu.querySelectorAll("button:not(:disabled)")],
        e.key === "ArrowDown" ? 1 : -1,
      );
    }
  };

  return (
    <>
      <div
        className={`gc-rback${sheet ? " dim" : ""}`}
        onPointerDown={() => onClose(false)}
      />

      <div
        ref={ref}
        className={`gc-rpop${full ? " full" : ""}${sheet ? " sheet" : ""}`}
        role="dialog"
        aria-label="Message actions"
        onKeyDown={onKeyDown}
      >
        {full ? (
          <div className="gc-full gc-glass">{picker}</div>
        ) : (
          <>
            {canReact && (
              <div
                className="gc-q gc-glass"
                role="toolbar"
                aria-label="Quick reactions"
              >
                {QUICK.map((e, i) => (
                  <button
                    key={e}
                    type="button"
                    className={`gc-q-btn${selected.has(e) ? " on" : ""}`}
                    style={{ "--i": i }}
                    aria-label={`React with ${e}`}
                    aria-pressed={selected.has(e)}
                    onClick={() => onPick(e)}
                  >
                    {e}
                  </button>
                ))}
                <span className="gc-q-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="gc-q-more"
                  aria-label="More emoji"
                  onClick={() => setFull(true)}
                >
                  <Ico name="plus" size={14} sw={1.8} />
                </button>
              </div>
            )}

            {actions.length > 0 && (
              <div
                className="gc-menu gc-glass"
                role="menu"
                aria-label="Message options"
              >
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    className={a.danger ? "danger" : undefined}
                    disabled={a.needsOnline && !canReact}
                    onClick={() => onAction(a.id)}
                  >
                    <span>{a.label}</span>
                    <Ico name={a.icon} size={15} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ───────────────────────────── composer ───────────────────────────── */

const Composer = React.memo(function Composer({
  onSend,
  rootRef,
  inputRef,
  offline,
  placeholder,
  onTyping,
}) {
  const [draft, setDraft] = useState("");
  const len = draft.length;
  const has = draft.trim().length > 0;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft, inputRef]);

  const submit = () => {
    if (!has) return;
    if (onSend(draft.trim())) {
      setDraft("");
      inputRef.current?.focus();
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="gc-comp" ref={rootRef}>
      <div className="gc-capsule">
        <textarea
          ref={inputRef}
          className="gc-input"
          rows={1}
          value={draft}
          maxLength={MAX}
          placeholder={
            offline ? "Reconnecting. Sending is paused" : placeholder
          }
          aria-label="Message"
          enterKeyHint="send"
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping(e.target.value.trim().length > 0);
          }}
          onBlur={() => onTyping(false)}
          onKeyDown={onKey}
        />

        <button
          type="button"
          className={`gc-send${has ? " on" : ""}`}
          onClick={submit}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Send message"
          tabIndex={has ? 0 : -1}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {len > MAX - 100 && (
        <div className="gc-count" data-warn={len >= MAX}>
          {MAX - len}
        </div>
      )}
    </div>
  );
});

/* ───────────────────────────── sheets and dialogs ───────────────────────────── */

function Sheet({ title, onClose, children }) {
  return (
    <div
      className="gc-sheet-wrap"
      data-layer
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="gc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="gc-sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="gc-icon sm"
            onClick={onClose}
            aria-label="Close"
          >
            <Ico name="close" size={14} sw={1.8} />
          </button>
        </header>
        <div className="gc-sheet-body">{children}</div>
      </section>
    </div>
  );
}

function ConfirmDialog({ confirm, onCancel, onConfirm }) {
  return (
    <div
      className="gc-delete-backdrop"
      data-layer
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <section
        className="gc-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gc-cf-title"
        aria-describedby="gc-cf-body"
      >
        <h2 id="gc-cf-title">{confirm.title}</h2>
        <p id="gc-cf-body">{confirm.body}</p>
        <div className="gc-delete-actions">
          <button
            type="button"
            className="gc-delete-cancel"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              confirm.danger ? "gc-delete-confirm" : "gc-delete-cancel"
            }
            onClick={onConfirm}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function RoomsSheet({ onClose, rooms, onOpen, onCreated, notify }) {
  const [tab, setTab] = useState("discover");
  const [list, setList] = useState(null);
  const [listErr, setListErr] = useState(false);
  const [link, setLink] = useState("");
  const [linkErr, setLinkErr] = useState("");
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState(ROOM_ICONS[0]);
  const [vis, setVis] = useState("public");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);

  const mine = useMemo(() => new Set(rooms.map((r) => r.slug)), [rooms]);

  const loadList = useCallback(async (signal) => {
    setListErr(false);
    setList(null);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, { signal });
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      setList(Array.isArray(data.rooms) ? data.rooms : []);
    } catch (e) {
      if (e.name === "AbortError") return;
      setListErr(true);
      setList([]);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadList(ac.signal);
    return () => ac.abort();
  }, [loadList]);

  const copy = async (text, ok) =>
    notify(
      (await copyText(text)) ? ok : "Couldn't copy. Select the text instead.",
    );

  const joinByLink = async (e) => {
    e.preventDefault();
    const slug = parseSlug(link);
    if (!slug) return setLinkErr("That doesn't look like a room link.");
    if (slug === "global") return onOpen(GLOBAL);

    setJoining(true);
    setLinkErr("");
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${slug}`);
      if (!res.ok) throw new Error("missing");
      const { room } = await res.json();
      onOpen(room);
    } catch {
      setLinkErr("Room not found. It may have been deleted.");
    } finally {
      setJoining(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: desc,
          icon,
          visibility: vis,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't create the room.");
      onCreated(data.room, data.ownerKey);
      setCreated({ room: data.room, key: data.ownerKey });
    } catch (error) {
      setErr(
        error instanceof TypeError
          ? "Can't reach the server. Check your connection."
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const { room, key } = created;
    return (
      <Sheet title="Room created" onClose={onClose}>
        <div className="gc-created">
          <div className="gc-tile big">{room.icon}</div>
          <h3>{room.name}</h3>
          <p className="gc-hint">
            Save your owner key now. It's the only way to rename or delete this
            room, and it can't be recovered.
          </p>
          <div className="gc-key">{key}</div>
          <div className="gc-btnrow">
            <button
              type="button"
              className="gc-soft"
              onClick={() => copy(key, "Owner key copied")}
            >
              <Ico name="copy" /> Copy key
            </button>
            <button
              type="button"
              className="gc-soft"
              onClick={() =>
                downloadText(
                  `rigidx-${room.slug}-owner-key.txt`,
                  `RigidX room: ${room.name}\nInvite link: ${inviteLink(room.slug)}\nOwner key: ${key}\n\nKeep this file private. Anyone with the key can manage the room.\n`,
                )
              }
            >
              <Ico name="download" /> Save file
            </button>
          </div>
          <button
            type="button"
            className="gc-soft wide"
            onClick={() => copy(inviteLink(room.slug), "Invite link copied")}
          >
            <Ico name="link" /> Copy invite link
          </button>
          <button
            type="button"
            className="gc-primary"
            onClick={() => onOpen(room)}
          >
            Open room
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Rooms" onClose={onClose}>
      <div className="gc-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "discover"}
          className={tab === "discover" ? "on" : ""}
          onClick={() => setTab("discover")}
        >
          Discover
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          className={tab === "create" ? "on" : ""}
          onClick={() => setTab("create")}
        >
          Create
        </button>
      </div>

      {tab === "discover" ? (
        <>
          <form className="gc-linkform" onSubmit={joinByLink}>
            <input
              className="gc-fi"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkErr("");
              }}
              placeholder="Paste an invite link"
              aria-label="Invite link"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="gc-soft"
              disabled={!link.trim() || joining}
            >
              {joining ? "Joining" : "Join"}
            </button>
          </form>
          {linkErr && <div className="gc-err">{linkErr}</div>}

          <div className="gc-list-h">Public rooms</div>

          {list === null && (
            <div className="gc-center">
              <Spinner />
            </div>
          )}

          {list && list.length === 0 && (
            <div className="gc-empty">
              {listErr ? (
                <>
                  <p>Couldn't load rooms.</p>
                  <button
                    type="button"
                    className="gc-soft"
                    onClick={() => loadList()}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <p>No public rooms yet. Create the first one.</p>
              )}
            </div>
          )}

          {list && list.length > 0 && (
            <ul className="gc-rlist">
              {list.map((r) => (
                <li key={r.slug}>
                  <button
                    type="button"
                    className="gc-ritem"
                    onClick={() => onOpen(r)}
                  >
                    <span className="gc-tile">{r.icon}</span>
                    <span className="gc-ritem-body">
                      <span className="gc-ritem-name">{r.name}</span>
                      <span className="gc-ritem-desc">
                        {r.description || "No description"}
                      </span>
                    </span>
                    <span className="gc-ritem-side">
                      <span>
                        {r.online > 0 ? `${r.online} online` : "Quiet"}
                      </span>
                      <span className="gc-ritem-cta">
                        {mine.has(r.slug) ? "Open" : "Join"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form className="gc-form" onSubmit={create}>
          <div className="gc-field">
            <span className="gc-label">Icon</span>
            <div className="gc-icons" role="radiogroup" aria-label="Room icon">
              {ROOM_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  role="radio"
                  aria-checked={icon === ic}
                  className={`gc-ic${icon === ic ? " on" : ""}`}
                  onClick={() => setIcon(ic)}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <label className="gc-field">
            <span className="gc-label">Name</span>
            <input
              className="gc-fi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Late night coders"
              required
              minLength={2}
              autoFocus
            />
          </label>

          <label className="gc-field">
            <span className="gc-label">Description</span>
            <input
              className="gc-fi"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={140}
              placeholder="What's this room about?"
            />
          </label>

          <div className="gc-field">
            <span className="gc-label">Who can find it</span>
            <div className="gc-tabs" role="radiogroup" aria-label="Visibility">
              <button
                type="button"
                role="radio"
                aria-checked={vis === "public"}
                className={vis === "public" ? "on" : ""}
                onClick={() => setVis("public")}
              >
                Public
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={vis === "private"}
                className={vis === "private" ? "on" : ""}
                onClick={() => setVis("private")}
              >
                Invite only
              </button>
            </div>
            <span className="gc-hint">
              {vis === "public"
                ? "Listed under Discover. Anyone can join."
                : "Hidden from Discover. Only people with the link can join."}
            </span>
          </div>

          {err && <div className="gc-err">{err}</div>}

          <button
            type="submit"
            className="gc-primary"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? "Creating" : "Create room"}
          </button>
        </form>
      )}
    </Sheet>
  );
}

function RoomInfoSheet({
  room,
  ownerKey,
  online,
  onClose,
  onLeave,
  onSaved,
  onAskDelete,
  notify,
}) {
  const [name, setName] = useState(room.name);
  const [desc, setDesc] = useState(room.description ?? "");
  const [busy, setBusy] = useState(false);

  const dirty =
    name.trim() !== room.name || desc.trim() !== (room.description ?? "");
  const copy = async (text, ok) =>
    notify(
      (await copyText(text)) ? ok : "Couldn't copy. Select the text instead.",
    );

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${room.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Owner-Key": ownerKey,
        },
        body: JSON.stringify({ name, description: desc }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save changes.");
      onSaved(data.room);
      notify("Saved");
    } catch (error) {
      notify(
        error instanceof TypeError ? "Can't reach the server." : error.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const report = () =>
    socket
      .timeout(ACK_TIMEOUT)
      .emit("room:report", { slug: room.slug }, (err, res) => {
        notify(
          !err && res?.ok
            ? "Thanks. We'll take a look."
            : res?.error || "Couldn't send the report.",
        );
      });

  return (
    <Sheet title="Room info" onClose={onClose}>
      <div className="gc-info-top">
        <div className="gc-tile big">{room.icon}</div>
        <div>
          <h3>{room.name}</h3>
          <p className="gc-hint">
            {room.visibility === "private" ? "Invite only" : "Public"}
            {online != null && ` · ${online} online`}
          </p>
        </div>
      </div>

      {room.description && <p className="gc-desc">{room.description}</p>}

      <div className="gc-field">
        <span className="gc-label">Invite link</span>
        <div className="gc-linkrow">
          <div className="gc-key sm">{inviteLink(room.slug)}</div>
          <button
            type="button"
            className="gc-soft"
            onClick={() => copy(inviteLink(room.slug), "Invite link copied")}
          >
            <Ico name="copy" /> Copy
          </button>
        </div>
      </div>

      {ownerKey && (
        <form className="gc-form" onSubmit={save}>
          <div className="gc-list-h">You own this room</div>
          <label className="gc-field">
            <span className="gc-label">Name</span>
            <input
              className="gc-fi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              minLength={2}
              required
            />
          </label>
          <label className="gc-field">
            <span className="gc-label">Description</span>
            <input
              className="gc-fi"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={140}
            />
          </label>
          <button
            type="submit"
            className="gc-primary"
            disabled={!dirty || busy || name.trim().length < 2}
          >
            {busy ? "Saving" : "Save changes"}
          </button>
          <button
            type="button"
            className="gc-soft wide"
            onClick={() => copy(ownerKey, "Owner key copied")}
          >
            <Ico name="copy" /> Copy owner key
          </button>
        </form>
      )}

      <div className="gc-actions">
        <button type="button" className="gc-soft wide" onClick={onLeave}>
          Leave room
        </button>
        {!ownerKey && (
          <button type="button" className="gc-soft wide" onClick={report}>
            <Ico name="flag" /> Report room
          </button>
        )}
        {ownerKey && (
          <button
            type="button"
            className="gc-soft wide danger"
            onClick={onAskDelete}
          >
            <Ico name="trash" /> Delete room
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ───────────────────────────── main component ───────────────────────────── */

export default function GlobalChat({ onBack, onSwitchToAI, initialRoom }) {
  const me = useSyncExternalStore(subscribeIdentity, getIdentity);
  const meRef = useRef(me);
  meRef.current = me;

  const [slug, setSlug] = useState(
    () =>
      parseSlug(initialRoom) ?? parseSlug(window.location.pathname) ?? "global",
  );
  const [rooms, setRooms] = useState(loadRooms);
  const [ownerKeys, setOwnerKeys] = useState(() => {
    const saved = readJSON(OWNER_KEYS_KEY, {});
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : {};
  });

  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [conn, setConn] = useState("connecting");
  const [online, setOnline] = useState(null);
  const [unread, setUnread] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [toast, setToast] = useState(null);
  const [typers, setTypers] = useState({});
  const [entered, setEntered] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [picker, setPicker] = useState(null);
  const [rootEl, setRootEl] = useState(null);
  const [sheet, setSheet] = useState(null); // "rooms" | "info"
  const [confirm, setConfirm] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [finishKey, setFinishKey] = useState(() => {
    try {
      const k = localStorage.getItem(THEME_KEY);
      return FINISHES[k] ? k : "spaceBlack";
    } catch {
      return "spaceBlack";
    }
  });
  const finish = FINISHES[finishKey];

  const winRef = useRef(null);
  const headRef = useRef(null);
  const compRef = useRef(null);
  const listRef = useRef(null);
  const topRef = useRef(null);
  const inputRef = useRef(null);
  const stripRef = useRef(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pickerRef = useRef(null);
  pickerRef.current = picker;
  const slugRef = useRef(slug);
  slugRef.current = slug;
  const uiRef = useRef({});
  uiRef.current = { confirm, sheet, editingId, themeOpen };

  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const atBottomRef = useRef(true);
  const stickRef = useRef(true);
  const smoothRef = useRef(false);
  const prependRef = useRef(null);
  const freshRef = useRef(new Set());
  const lastSendRef = useRef(0);
  const lastTypingRef = useRef(0);
  const typingTimersRef = useRef({});
  const toastTimersRef = useRef([]);
  const closingRef = useRef(false);
  const aliveRef = useRef(true);
  const baseUrlRef = useRef(
    /^\/c\//.test(window.location.pathname)
      ? "/"
      : window.location.pathname + window.location.search,
  );

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      toastTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => writeJSON(ROOMS_KEY, rooms), [rooms]);
  useEffect(() => writeJSON(OWNER_KEYS_KEY, ownerKeys), [ownerKeys]);

  const activeMeta = useMemo(
    () =>
      slug === "global"
        ? GLOBAL
        : (rooms.find((r) => r.slug === slug) ?? {
            slug,
            name: "Room",
            icon: "💬",
            description: "",
            visibility: "public",
          }),
    [slug, rooms],
  );
  const ownerKey = slug !== "global" ? ownerKeys[slug] : undefined;
  const isGlobal = slug === "global";
  const title = isGlobal ? "Global chat" : activeMeta.name;

  /* ── toast + announcements ── */

  const notify = useCallback((text) => {
    if (!text) return;
    toastTimersRef.current.forEach(clearTimeout);
    setToast({ id: Date.now(), text, on: true });
    setAnnounce(text);
    toastTimersRef.current = [
      setTimeout(() => setToast((t) => (t ? { ...t, on: false } : t)), 2800),
      setTimeout(() => setToast(null), 3300),
    ];
  }, []);

  /* ── room list management ── */

  const upsertRoom = useCallback((meta) => {
    if (!meta?.slug || meta.slug === "global" || !SLUG_RE.test(meta.slug))
      return;
    const entry = {
      slug: meta.slug,
      name: String(meta.name ?? meta.slug).slice(0, 40),
      icon: meta.icon || "💬",
      description: String(meta.description ?? "").slice(0, 140),
      visibility: meta.visibility === "private" ? "private" : "public",
    };
    setRooms((prev) => {
      const i = prev.findIndex((r) => r.slug === entry.slug);
      if (i === -1) return [...prev, entry].slice(-30);
      const o = prev[i];
      if (
        o.name === entry.name &&
        o.icon === entry.icon &&
        o.description === entry.description &&
        o.visibility === entry.visibility
      ) {
        return prev;
      }
      const next = prev.slice();
      next[i] = entry;
      return next;
    });
  }, []);

  const removeRoom = useCallback((target) => {
    setRooms((prev) => prev.filter((r) => r.slug !== target));
    setSlug((cur) => (cur === target ? "global" : cur));
  }, []);

  const forgetRoom = useCallback(
    (target, message) => {
      removeRoom(target);
      setOwnerKeys((keys) => {
        if (!(target in keys)) return keys;
        const { [target]: _gone, ...rest } = keys;
        return rest;
      });
      setSheet(null);
      if (message) notify(message);
    },
    [removeRoom, notify],
  );

  const openRoom = useCallback(
    (meta) => {
      if (meta.slug !== "global") upsertRoom(meta);
      setSheet(null);
      setPicker(null);
      setSlug(meta.slug);
    },
    [upsertRoom],
  );

  const handleCreated = useCallback(
    (room, key) => {
      upsertRoom(room);
      setOwnerKeys((keys) => ({ ...keys, [room.slug]: key }));
    },
    [upsertRoom],
  );

  /* ── data loading ── */

  const fetchPage = useCallback(async (room, before, signal) => {
    const qs = new URLSearchParams({ room, limit: String(PAGE) });
    if (before) qs.set("before", before);

    const res = await fetch(`${API_BASE}/api/messages?${qs}`, { signal });
    if (res.status === 404) {
      const e = new Error("not_found");
      e.code = 404;
      throw e;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return {
      rows: (data.messages ?? []).map(normalize),
      more: Boolean(data.hasMore),
    };
  }, []);

  // Applies the newest page to what we already have. Fixes three reconnect problems:
  // missed messages, messages deleted while offline, and gaps larger than one page.
  const applyLatest = useCallback((rows, more) => {
    const current = messagesRef.current;
    const persisted = current.filter((m) => m._id);
    const pending = current.filter((m) => !m._id);
    const oldest = rows[0]?._id;
    const newestKnown = persisted[persisted.length - 1]?._id;

    const gap =
      Boolean(oldest) && persisted.length > 0 && more && newestKnown < oldest;
    const keep = !oldest || gap ? [] : persisted.filter((m) => m._id < oldest);

    if (keep.length === 0) {
      hasMoreRef.current = more;
      setHasMore(more);
    }
    if (atBottomRef.current || gap) stickRef.current = true;

    setMessages(mergeMessages([...keep, ...pending], rows));
  }, []);

  // Room change or manual retry: reset and load the newest page.
  useEffect(() => {
    const ac = new AbortController();

    messagesRef.current = [];
    setMessages([]);
    setPhase("loading");
    setHasMore(false);
    hasMoreRef.current = false;
    setOlderError(false);
    setUnread(0);
    setShowJump(false);
    setTypers({});
    setOnline(null);
    setEditingId(null);
    setPicker(null);
    stickRef.current = true;
    atBottomRef.current = true;
    smoothRef.current = false;
    prependRef.current = null;
    freshRef.current.clear();

    fetchPage(slug, null, ac.signal)
      .then(({ rows, more }) => {
        applyLatest(rows, more);
        setPhase("ready");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.code === 404)
          forgetRoom(slug, "That room doesn't exist anymore.");
        else setPhase("error");
      });

    return () => ac.abort();
  }, [slug, attempt, fetchPage, applyLatest, forgetRoom]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current.find((m) => m._id);
    if (!oldest) return;

    const forRoom = slugRef.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setOlderError(false);

    try {
      const { rows, more } = await fetchPage(forRoom, oldest._id);
      if (!aliveRef.current || slugRef.current !== forRoom) return;

      const el = listRef.current;
      prependRef.current = el ? el.scrollHeight : null;

      setMessages((prev) => mergeMessages(prev, rows));
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      if (aliveRef.current) setOlderError(true);
    } finally {
      loadingOlderRef.current = false;
      if (aliveRef.current) setLoadingOlder(false);
    }
  }, [fetchPage]);

  /* ── realtime ── */

  useEffect(() => {
    let disposed = false;

    const resync = async () => {
      try {
        const { rows, more } = await fetchPage(slug, null);
        if (!disposed) applyLatest(rows, more);
      } catch {
        /* the next reconnect will try again */
      }
    };

    // The server forgets room membership when a socket drops, so rejoin on every connect.
    const join = () => {
      setConn("connecting");
      socket.timeout(ACK_TIMEOUT).emit("room:join", { slug }, (err, res) => {
        if (disposed) return;
        if (err) return setConn("offline");
        if (!res?.ok) {
          if (res?.code === "not_found")
            forgetRoom(slug, "That room doesn't exist anymore.");
          else {
            setConn("offline");
            notify(res?.error || "Couldn't join the room.");
          }
          return;
        }
        setConn("live");
        setOnline(typeof res.online === "number" ? res.online : null);
        if (slug !== "global" && res.room) upsertRoom(res.room);
        resync();
      });
    };

    const onDown = () => setConn("offline");

    const onNew = (raw) => {
      if (!raw || raw.roomSlug !== slug || typeof raw.text !== "string") return;
      const m = normalize(raw);
      if (m.clientId) freshRef.current.add(m.clientId);
      if (m._id) freshRef.current.add(m._id);

      const mine = m.authorId === meRef.current.authorId;
      if (mine || atBottomRef.current) stickRef.current = true;
      else setUnread((u) => u + 1);
      if (!mine) setAnnounce(`${m.handle}: ${m.text}`);

      setMessages((prev) => mergeMessages(prev, [m]));
    };

    const onTypingUpdate = (p) => {
      if (
        !p ||
        p.slug !== slug ||
        !p.authorId ||
        p.authorId === meRef.current.authorId
      )
        return;
      const id = String(p.authorId);
      window.clearTimeout(typingTimersRef.current[id]);

      const drop = () =>
        setTypers((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });

      if (p.isTyping) {
        setTypers((prev) => ({ ...prev, [id]: p.handle || "Someone" }));
        typingTimersRef.current[id] = window.setTimeout(drop, 3000);
      } else drop();
    };

    const onUpdated = (p) => {
      const u = p?.message;
      if (!u?._id || u.roomSlug !== slug) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(u._id) ? { ...m, ...normalize(u) } : m,
        ),
      );
    };

    const onDeleted = (p) => {
      if (!p?.messageId || (p.slug && p.slug !== slug)) return;
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(p.messageId)),
      );
    };

    const onReaction = (p) => {
      const u = p?.message;
      if (!u?._id || u.roomSlug !== slug) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(u._id)
            ? { ...m, reactions: u.reactions || {} }
            : m,
        ),
      );
    };

    const onPresence = (p) => {
      if (p?.slug === slug && typeof p.count === "number") setOnline(p.count);
    };

    const onRoomUpdated = (r) => {
      if (r?.slug === slug) upsertRoom(r);
    };

    const onRoomDeleted = (r) => {
      if (r?.slug === slug) forgetRoom(slug, "This room was deleted.");
    };

    socket.on("connect", join);
    socket.on("disconnect", onDown);
    socket.on("connect_error", onDown);
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reaction:update", onReaction);
    socket.on("typing:update", onTypingUpdate);
    socket.on("presence:count", onPresence);
    socket.on("room:updated", onRoomUpdated);
    socket.on("room:deleted", onRoomDeleted);

    if (socket.connected) join();
    else openSocket();

    return () => {
      disposed = true;
      if (socket.connected) socket.emit("room:leave", { slug });
      socket.off("connect", join);
      socket.off("disconnect", onDown);
      socket.off("connect_error", onDown);
      socket.off("message:new", onNew);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.off("message:reaction:update", onReaction);
      socket.off("typing:update", onTypingUpdate);
      socket.off("presence:count", onPresence);
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:deleted", onRoomDeleted);
      Object.values(typingTimersRef.current).forEach(window.clearTimeout);
      typingTimersRef.current = {};
    };
  }, [slug, fetchPage, applyLatest, forgetRoom, upsertRoom, notify]);

  // The socket is shared; close it only when the chat itself goes away.
  useEffect(() => () => closeSocket(), []);

  /* ── URL sync: /c/<slug> deep links ── */

  useEffect(() => {
    try {
      window.history.replaceState(
        window.history.state,
        "",
        isGlobal ? baseUrlRef.current : `/c/${slug}`,
      );
    } catch {
      /* some sandboxes block history changes */
    }
  }, [slug, isGlobal]);

  useEffect(
    () => () => {
      try {
        window.history.replaceState(
          window.history.state,
          "",
          baseUrlRef.current,
        );
      } catch {
        /* ignore */
      }
    },
    [],
  );

  /* ── sending, editing, deleting, reacting ── */

  const patch = useCallback((clientId, fields) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.clientId === clientId && m.status === "sending"
          ? { ...m, ...fields }
          : m,
      ),
    );
  }, []);

  const dispatch = useCallback(
    (msg) => {
      if (!socket.connected) {
        patch(msg.clientId, { status: "failed", error: "You're offline" });
        return;
      }

      socket
        .timeout(ACK_TIMEOUT)
        .emit(
          "message:send",
          { slug: slugRef.current, clientId: msg.clientId, text: msg.text },
          (err, res) => {
            if (err)
              return patch(msg.clientId, {
                status: "failed",
                error: "Timed out",
              });
            if (!res?.ok) {
              patch(msg.clientId, { status: "failed", error: res?.error });
              if (res?.error) notify(res.error);
              return;
            }
            if (res.message) {
              if (res.message._id) freshRef.current.add(res.message._id);
              setMessages((prev) =>
                mergeMessages(prev, [normalize(res.message)]),
              );
            }
          },
        );
    },
    [patch, notify],
  );

  const handleTyping = useCallback((isTyping) => {
    if (!socket.connected) return;
    const now = Date.now();
    if (isTyping && now - lastTypingRef.current < 700) return;
    lastTypingRef.current = now;
    socket.emit("typing", { slug: slugRef.current, isTyping });
  }, []);

  const send = useCallback(
    (text) => {
      const now = Date.now();
      if (now - lastSendRef.current < SEND_GAP) return false;
      if (!socket.connected) {
        notify("You're offline. Your message is still in the box.");
        return false;
      }

      lastSendRef.current = now;
      handleTyping(false);

      const msg = normalize({
        clientId: newClientId(),
        text,
        authorId: meRef.current.authorId,
        handle: meRef.current.handle,
        roomSlug: slugRef.current,
        reactions: {},
        createdAt: new Date(now).toISOString(),
        status: "sending",
      });

      freshRef.current.add(msg.clientId);
      stickRef.current = true;
      setMessages((prev) => mergeMessages(prev, [msg]));
      dispatch(msg);
      return true;
    },
    [dispatch, handleTyping, notify],
  );

  const retry = useCallback(
    (m) => {
      stickRef.current = true;
      setMessages((prev) =>
        prev.map((x) =>
          x.clientId === m.clientId
            ? { ...x, status: "sending", error: undefined }
            : x,
        ),
      );
      dispatch({ ...m, status: "sending" });
    },
    [dispatch],
  );

  const discard = useCallback(
    (m) => setMessages((prev) => prev.filter((x) => x.clientId !== m.clientId)),
    [],
  );

  const emitWithAck = useCallback(
    (event, payload, onOk, fallback) => {
      if (!socket.connected) return notify("You're offline.");
      socket
        .timeout(ACK_TIMEOUT)
        .emit(event, { slug: slugRef.current, ...payload }, (err, res) => {
          if (err || !res?.ok) return notify(res?.error || fallback);
          onOk?.(res);
        });
    },
    [notify],
  );

  const saveEdit = useCallback(
    (message, text) => {
      const value = text.trim();
      setEditingId(null);
      if (!value || value === message.text) return;
      emitWithAck(
        "message:edit",
        { messageId: message._id, text: value },
        (res) => {
          if (res.message) {
            setMessages((prev) =>
              prev.map((x) =>
                String(x._id) === String(res.message._id)
                  ? { ...x, ...normalize(res.message) }
                  : x,
              ),
            );
          }
        },
        "Couldn't edit that message.",
      );
    },
    [emitWithAck],
  );

  const removeLocal = useCallback(
    (id) =>
      setMessages((prev) => prev.filter((x) => String(x._id) !== String(id))),
    [],
  );

  const deleteOwn = useCallback(
    (message) =>
      emitWithAck(
        "message:delete",
        { messageId: message._id },
        () => removeLocal(message._id),
        "Couldn't delete that message.",
      ),
    [emitWithAck, removeLocal],
  );

  const removeAsOwner = useCallback(
    async (message) => {
      const key = ownerKeys[slugRef.current];
      if (!key) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/rooms/${slugRef.current}/messages/${message._id}`,
          {
            method: "DELETE",
            headers: { "X-Owner-Key": key },
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || "Couldn't remove that message.");
        removeLocal(message._id);
      } catch (error) {
        notify(
          error instanceof TypeError
            ? "Can't reach the server."
            : error.message,
        );
      }
    },
    [ownerKeys, removeLocal, notify],
  );

  const toggleLocal = useCallback((messageId, emoji) => {
    const id = meRef.current.authorId;
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m._id) !== String(messageId)) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
        const next = users.includes(id)
          ? users.filter((u) => u !== id)
          : [...users, id];
        if (next.length) reactions[emoji] = next;
        else delete reactions[emoji];
        return { ...m, reactions };
      }),
    );
  }, []);

  const reactToMessage = useCallback(
    (messageId, emoji) => {
      if (!socket.connected || !messageId || !emoji) return;
      toggleLocal(messageId, emoji);
      socket
        .timeout(ACK_TIMEOUT)
        .emit(
          "message:reaction",
          { slug: slugRef.current, messageId, emoji },
          (err, res) => {
            if (err) return notify("That reaction may not have saved.");
            if (!res?.ok) {
              toggleLocal(messageId, emoji); // roll back
              notify(res?.error || "Couldn't update the reaction.");
            }
          },
        );
    },
    [toggleLocal, notify],
  );

  /* ── picker + message actions ── */

  const openPicker = useCallback((id, anchorEl) => {
    setThemeOpen(false);
    setPicker((p) => (p && p.id === id ? null : { id, anchorEl }));
  }, []);

  const closePicker = useCallback((restoreFocus) => {
    const p = pickerRef.current;
    setPicker(null);
    if (restoreFocus) p?.anchorEl?.focus?.({ preventScroll: true });
  }, []);

  const pickEmoji = useCallback(
    (emoji) => {
      const p = pickerRef.current;
      if (!p) return;
      reactToMessage(p.id, emoji);
      closePicker(Boolean(document.activeElement?.matches?.(":focus-visible")));
    },
    [reactToMessage, closePicker],
  );

  const pickerMessage = useMemo(
    () =>
      picker ? messages.find((x) => String(x._id) === String(picker.id)) : null,
    [picker, messages],
  );

  const pickerSelected = useMemo(() => {
    const s = new Set();
    for (const [emoji, users] of Object.entries(
      pickerMessage?.reactions || {},
    )) {
      if (Array.isArray(users) && users.includes(me.authorId)) s.add(emoji);
    }
    return pickerMessage ? s : NONE;
  }, [pickerMessage, me.authorId]);

  const pickerActions = useMemo(() => {
    if (!pickerMessage) return [];
    const mine = pickerMessage.authorId === me.authorId;
    const list = [{ id: "copy", label: "Copy text", icon: "copy" }];
    if (mine) {
      list.push({
        id: "edit",
        label: "Edit",
        icon: "pencil",
        needsOnline: true,
      });
      list.push({
        id: "delete",
        label: "Delete",
        icon: "trash",
        danger: true,
        needsOnline: true,
      });
    } else {
      list.push({
        id: "report",
        label: "Report",
        icon: "flag",
        needsOnline: true,
      });
      if (ownerKey)
        list.push({
          id: "remove",
          label: "Remove from room",
          icon: "trash",
          danger: true,
        });
    }
    return list;
  }, [pickerMessage, me.authorId, ownerKey]);

  const runAction = useCallback(
    async (id) => {
      const message =
        pickerRef.current &&
        messagesRef.current.find(
          (x) => String(x._id) === String(pickerRef.current.id),
        );
      setPicker(null);
      if (!message) return;

      if (id === "copy") {
        notify((await copyText(message.text)) ? "Copied" : "Couldn't copy.");
      } else if (id === "edit") {
        setEditingId(message._id);
      } else if (id === "delete") {
        setConfirm({
          title: "Delete message?",
          body: "This message will be deleted for everyone in the chat.",
          confirmLabel: "Delete for everyone",
          danger: true,
          onConfirm: () => deleteOwn(message),
        });
      } else if (id === "remove") {
        setConfirm({
          title: "Remove this message?",
          body: "It will be removed for everyone in this room.",
          confirmLabel: "Remove",
          danger: true,
          onConfirm: () => removeAsOwner(message),
        });
      } else if (id === "report") {
        emitWithAck(
          "message:report",
          { messageId: message._id },
          () => notify("Thanks. We'll take a look."),
          "Couldn't send the report.",
        );
      }
    },
    [notify, deleteOwn, removeAsOwner, emitWithAck],
  );

  const askDeleteRoom = useCallback(() => {
    const target = slugRef.current;
    const key = ownerKeys[target];
    setConfirm({
      title: "Delete this room?",
      body: "Everyone is removed and its messages become unavailable. This can't be undone.",
      confirmLabel: "Delete room",
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/rooms/${target}`, {
            method: "DELETE",
            headers: { "X-Owner-Key": key },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data.error || "Couldn't delete the room.");
          forgetRoom(target, "Room deleted");
        } catch (error) {
          notify(
            error instanceof TypeError
              ? "Can't reach the server."
              : error.message,
          );
        }
      },
    });
  }, [ownerKeys, forgetRoom, notify]);

  /* ── scrolling ── */

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || phase !== "ready") return;

    if (prependRef.current != null) {
      el.scrollTop += el.scrollHeight - prependRef.current;
      prependRef.current = null;
      return;
    }

    if (stickRef.current) {
      stickRef.current = false;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smoothRef.current ? "smooth" : "auto",
      });
      smoothRef.current = true;
    }
  }, [messages, phase]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const at = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = at;
    setShowJump(!at);
    if (at) setUnread(0);
  };

  const jump = () =>
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });

  useEffect(() => {
    const root = listRef.current;
    const target = topRef.current;
    if (phase !== "ready" || !hasMore || !root || !target) return;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) loadOlder();
      },
      { root, rootMargin: "300px 0px 0px 0px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [phase, hasMore, messages.length, loadOlder]);

  useLayoutEffect(() => {
    const win = winRef.current;
    if (!win || typeof ResizeObserver === "undefined") return;

    const set = () => {
      if (!headRef.current || !compRef.current) return;
      win.style.setProperty("--hh", `${headRef.current.offsetHeight}px`);
      win.style.setProperty("--ch", `${compRef.current.offsetHeight}px`);
      const el = listRef.current;
      if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    };

    const ro = new ResizeObserver(set);
    ro.observe(headRef.current);
    ro.observe(compRef.current);
    set();
    return () => ro.disconnect();
  }, []);

  /* ── window lifecycle ── */

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const t = setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      380,
    );
    return () => clearTimeout(t);
  }, [slug]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keep the active room chip in view without scrolling any ancestor.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector('[aria-current="true"]');
    if (!strip || !chip) return;
    strip.scrollTo({
      left: chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [slug, rooms.length]);

  const leave = useCallback((cb) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setEntered(false);
    setPicker(null);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setTimeout(() => cb?.(), reduce ? 0 : 300);
  }, []);

  const close = useCallback(() => leave(onBack), [leave, onBack]);
  const toAI = useCallback(() => leave(onSwitchToAI), [leave, onSwitchToAI]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const ui = uiRef.current;
        if (pickerRef.current) closePicker(true);
        else if (ui.confirm) setConfirm(null);
        else if (ui.sheet) setSheet(null);
        else if (ui.editingId) setEditingId(null);
        else if (ui.themeOpen) setThemeOpen(false);
        else close();
        return;
      }

      // The reaction popover lives outside the window and traps its own focus.
      if (e.key !== "Tab" || !winRef.current || pickerRef.current) return;

      const layers = winRef.current.querySelectorAll("[data-layer]");
      const scope = layers.length ? layers[layers.length - 1] : winRef.current;
      const nodes = scope.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"]), textarea, input',
      );
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, closePicker]);

  const onWinMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const w = winRef.current;
    const r = w.getBoundingClientRect();
    w.style.setProperty("--mx", `${e.clientX - r.left}px`);
    w.style.setProperty("--my", `${e.clientY - r.top}px`);
    w.style.setProperty("--lit", "1");
  };

  const onWinLeave = () => winRef.current?.style.setProperty("--lit", "0");

  const pickFinish = (k) => {
    setFinishKey(k);
    setThemeOpen(false);
    try {
      localStorage.setItem(THEME_KEY, k);
    } catch {
      /* ignore */
    }
  };

  /* ── derived view data ── */

  const days = useMemo(() => {
    const out = [];

    messages.forEach((m, i) => {
      const d = new Date(m.t);
      const prev = messages[i - 1];
      const next = messages[i + 1];
      let day = out[out.length - 1];

      if (!prev || !sameDay(new Date(prev.t), d)) {
        day = { key: d.toDateString(), label: dayLabel(d), rows: [] };
        out.push(day);
      }

      const first =
        !prev ||
        prev.authorId !== m.authorId ||
        m.t - prev.t > GROUP_MS ||
        !sameDay(new Date(prev.t), d);
      const last =
        !next ||
        next.authorId !== m.authorId ||
        next.t - m.t > GROUP_MS ||
        !sameDay(new Date(next.t), d);

      day.rows.push({
        key: m.clientId || m._id,
        m,
        first,
        last,
        mine: m.authorId === me.authorId,
      });
    });

    return out;
  }, [messages, me.authorId]);

  const statusText =
    conn === "live"
      ? online != null
        ? `${online.toLocaleString()} online`
        : "Live"
      : conn === "connecting"
        ? "Connecting"
        : "Offline, reconnecting";

  const typerNames = Object.values(typers);
  const empty = phase === "ready" && messages.length === 0;
  const canReact = conn === "live";

  /* ───────────────────────────── render ───────────────────────────── */

  return (
    <div
      ref={setRootEl}
      className={`gc-root${entered ? " in" : ""}`}
      style={{ "--accent": finish.bubble, "--accent-ink": finish.ink }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <style>{css}</style>

      <div
        ref={winRef}
        className="gc-window"
        role="dialog"
        aria-modal="true"
        aria-label={`${title}`}
        onPointerMove={onWinMove}
        onPointerLeave={onWinLeave}
        onPointerDown={(e) => {
          if (themeOpen && !e.target.closest("[data-theme-ui]"))
            setThemeOpen(false);
        }}
      >
        <header ref={headRef} className="gc-head">
          <div className="gc-left">
            <button
              type="button"
              className="gc-icon"
              onClick={close}
              aria-label="Close chat"
            >
              <svg
                width="9"
                height="15"
                viewBox="0 0 9 15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7.5 1.5L1.5 7.5l6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <span className="gc-tile" aria-hidden="true" key={slug}>
              {isGlobal ? <Ico name="globe" size={17} /> : activeMeta.icon}
            </span>

            <div className="gc-title">
              <div className="gc-t1">{title}</div>
              <div className="gc-t2">
                <span className={`gc-dot ${conn}`} />
                {statusText}
              </div>
            </div>
          </div>

          {onSwitchToAI && (
            <div className="gc-seg" role="tablist" aria-label="Chat mode">
              <span className="gc-thumb" aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected="false"
                onClick={toAI}
              >
                Private
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="active"
              >
                Global
              </button>
            </div>
          )}

          <div className="gc-right" data-theme-ui>
            {!isGlobal && (
              <button
                type="button"
                className="gc-icon"
                onClick={() => {
                  setPicker(null);
                  setSheet("info");
                }}
                aria-label="Room info"
              >
                <Ico name="info" size={17} />
              </button>
            )}

            <button
              type="button"
              className="gc-icon"
              onClick={() => {
                setPicker(null);
                setThemeOpen((v) => !v);
              }}
              aria-label="Bubble finish"
              aria-expanded={themeOpen}
            >
              <span
                className="gc-swatch big"
                style={{ background: finish.bubble }}
              />
            </button>

            <div
              className={`gc-pop${themeOpen ? " open" : ""}`}
              role="menu"
              aria-hidden={!themeOpen}
            >
              {Object.entries(FINISHES).map(([k, f]) => (
                <button
                  key={k}
                  type="button"
                  role="menuitemradio"
                  aria-checked={k === finishKey}
                  tabIndex={themeOpen ? 0 : -1}
                  onClick={() => pickFinish(k)}
                >
                  <span
                    className="gc-swatch"
                    style={{ background: f.bubble }}
                  />
                  <span className="gc-pop-name">{f.name}</span>
                  {k === finishKey && <Ico name="check" size={14} sw={1.8} />}
                </button>
              ))}
            </div>
          </div>

          <nav ref={stripRef} className="gc-rooms" aria-label="Rooms">
            <button
              type="button"
              className={`gc-rchip${isGlobal ? " on" : ""}`}
              aria-current={isGlobal}
              onClick={() => openRoom(GLOBAL)}
            >
              <Ico name="globe" size={14} />
              <span className="gc-rchip-n">Global</span>
            </button>

            {rooms.map((r) => (
              <button
                key={r.slug}
                type="button"
                className={`gc-rchip${r.slug === slug ? " on" : ""}`}
                aria-current={r.slug === slug}
                title={r.name}
                onClick={() => openRoom(r)}
              >
                <span className="gc-rchip-ic" aria-hidden="true">
                  {r.icon}
                </span>
                <span className="gc-rchip-n">{r.name}</span>
                {r.visibility === "private" && <Ico name="lock" size={11} />}
              </button>
            ))}

            <button
              type="button"
              className="gc-rchip add"
              onClick={() => {
                setPicker(null);
                setSheet("rooms");
              }}
              aria-label="Browse or create rooms"
            >
              <Ico name="plus" size={14} sw={1.8} />
              <span className="gc-rchip-n">Rooms</span>
            </button>
          </nav>
        </header>

        <div
          ref={listRef}
          className="gc-list"
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label={`${title} messages`}
        >
          <div className="gc-inner">
            <div ref={topRef} className="gc-top" />

            {phase === "ready" && loadingOlder && (
              <div className="gc-older">
                <Spinner />
              </div>
            )}

            {phase === "ready" && olderError && (
              <div className="gc-older">
                <span>Couldn't load older messages.</span>
                <button type="button" onClick={loadOlder}>
                  Try again
                </button>
              </div>
            )}

            {phase === "ready" && !hasMore && messages.length > 0 && (
              <div className="gc-begin">Beginning of the conversation</div>
            )}

            {days.map((day) => (
              <section className="gc-day" key={day.key}>
                <div className="gc-daypill">{day.label}</div>

                {day.rows.map((r) => (
                  <Row
                    key={r.key}
                    m={r.m}
                    first={r.first}
                    last={r.last}
                    mine={r.mine}
                    fresh={
                      freshRef.current.has(r.m.clientId) ||
                      freshRef.current.has(r.m._id)
                    }
                    canReact={canReact}
                    pickerActive={
                      Boolean(picker) && String(picker.id) === String(r.m._id)
                    }
                    editing={
                      editingId != null && String(editingId) === String(r.m._id)
                    }
                    onRetry={retry}
                    onDiscard={discard}
                    onReact={reactToMessage}
                    onOpenPicker={openPicker}
                    onEditSave={saveEdit}
                    onEditCancel={() => setEditingId(null)}
                    me={me}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>

        {phase === "loading" && (
          <div className="gc-state">
            <Spinner />
          </div>
        )}

        {phase === "error" && (
          <div className="gc-state">
            <div className="gc-s1">Can't load this chat</div>
            <div className="gc-s2">
              The server didn't respond. Check your connection, then try again.
            </div>
            <button
              type="button"
              className="gc-btn"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {empty && (
          <div className="gc-state">
            <div className="gc-s1">Nothing here yet</div>
            <div className="gc-s2">
              {isGlobal
                ? "Send the first message. It stays here for everyone who joins later."
                : activeMeta.visibility === "private"
                  ? "Send the first message, then share the invite link to bring people in."
                  : "Send the first message. It stays here for everyone who joins later."}
            </div>
          </div>
        )}

        <button
          type="button"
          className={`gc-jump${showJump ? " on" : ""}`}
          onClick={jump}
          tabIndex={showJump ? 0 : -1}
          aria-label={
            unread ? `${unread} new messages, jump to latest` : "Jump to latest"
          }
        >
          {unread > 0 ? `${unread} new` : "Latest"}
          <Ico name="check" size={0} />
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.5L6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {typerNames.length > 0 && (
          <div className="gc-typing" aria-live="polite">
            {typerNames.length === 1
              ? `${typerNames[0]} is typing…`
              : typerNames.length === 2
                ? `${typerNames.join(" and ")} are typing…`
                : `${typerNames.length} people are typing…`}
          </div>
        )}

        <Composer
          key={slug}
          onSend={send}
          rootRef={compRef}
          inputRef={inputRef}
          offline={conn !== "live"}
          placeholder={
            isGlobal ? "Message everyone" : `Message ${activeMeta.name}`
          }
          onTyping={handleTyping}
        />

        <div className="gc-sr" aria-live="polite">
          {announce}
        </div>

        {toast && (
          <div
            key={toast.id}
            className={`gc-toast${toast.on ? " on" : ""}`}
            role="status"
          >
            {toast.text}
          </div>
        )}

        {sheet === "rooms" && (
          <RoomsSheet
            onClose={() => setSheet(null)}
            rooms={rooms}
            onOpen={openRoom}
            onCreated={handleCreated}
            notify={notify}
          />
        )}

        {sheet === "info" && !isGlobal && (
          <RoomInfoSheet
            room={activeMeta}
            ownerKey={ownerKey}
            online={online}
            onClose={() => setSheet(null)}
            onLeave={() => forgetLocalOnly()}
            onSaved={upsertRoom}
            onAskDelete={askDeleteRoom}
            notify={notify}
          />
        )}

        {confirm && (
          <ConfirmDialog
            confirm={confirm}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              const run = confirm.onConfirm;
              setConfirm(null);
              run?.();
            }}
          />
        )}
      </div>

      {picker &&
        rootEl &&
        createPortal(
          <ReactionPopover
            key={picker.id}
            anchorEl={picker.anchorEl}
            listEl={listRef.current}
            selected={pickerSelected}
            canReact={canReact}
            actions={pickerActions}
            onPick={pickEmoji}
            onAction={runAction}
            onClose={closePicker}
          />,
          rootEl,
        )}
    </div>
  );

  // Leaving a room only removes it from this device's list. The owner key is kept,
  // so an owner can rejoin later and still manage the room.
  function forgetLocalOnly() {
    const target = slugRef.current;
    removeRoom(target);
    setSheet(null);
    notify("Left the room");
  }
}

/* ───────────────────────────── styles ───────────────────────────── */

const css = `
.gc-root{
  --label:#f5f5f7;--label2:rgba(235,235,245,.62);--label3:rgba(235,235,245,.36);
  --fill:rgba(120,120,128,.26);--sep:rgba(255,255,255,.09);
  --hh:104px;--ch:76px;
  --ease:cubic-bezier(.32,.72,0,1);--spring:cubic-bezier(.34,1.56,.64,1);
  --emoji:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;
  position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:16px;color:var(--label);color-scheme:dark;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Geist","Inter",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
  background:rgba(0,0,0,0);
  transition:background .55s var(--ease),-webkit-backdrop-filter .55s var(--ease),backdrop-filter .55s var(--ease);
}
.gc-root.in{background:rgba(0,0,0,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.gc-root *{box-sizing:border-box}
.gc-root button{font:inherit;color:inherit;-webkit-appearance:none;appearance:none}
.gc-root button:focus-visible,.gc-input:focus-visible,.gc-fi:focus-visible{outline:2px solid rgba(255,255,255,.75);outline-offset:2px}

.gc-window{
  position:relative;width:min(880px,100%);height:min(780px,100%);overflow:hidden;isolation:isolate;
  border-radius:30px;background:rgba(30,30,32,.58);
  -webkit-backdrop-filter:blur(48px) saturate(190%);backdrop-filter:blur(48px) saturate(190%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.16),inset 0 1px 0 rgba(255,255,255,.14),
    0 44px 90px -24px rgba(0,0,0,.7),0 12px 30px -12px rgba(0,0,0,.5);
  opacity:0;transform:translateY(20px) scale(.965);
  transition:opacity .45s var(--ease),transform .65s var(--ease);
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .gc-window{background:rgba(28,28,30,.97)}
  .gc-head,.gc-comp,.gc-glass,.gc-sheet{background:rgba(28,28,30,.97)!important}
}
.gc-root.in .gc-window{opacity:1;transform:none}
.gc-window::before{
  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(520px circle at var(--mx,50%) var(--my,-10%),rgba(255,255,255,.085),transparent 62%);
  opacity:var(--lit,0);transition:opacity .45s;
}
.gc-window::after{
  content:"";position:absolute;left:12%;right:12%;top:0;height:1px;z-index:6;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
}

.gc-head{
  position:absolute;top:0;left:0;right:0;z-index:4;
  display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px 12px;
  padding:14px 16px 10px;background:rgba(30,30,32,.4);
  -webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
  border-bottom:.5px solid var(--sep);
}
.gc-left{display:flex;align-items:center;gap:10px;min-width:0}
.gc-right{position:relative;grid-column:3;justify-self:end;display:flex;align-items:center;gap:8px}
.gc-icon{
  flex:none;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;
  display:grid;place-items:center;background:var(--fill);
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.14);
  transition:transform .35s var(--spring),background .25s;
}
.gc-icon.sm{width:30px;height:30px}
.gc-icon:hover{background:rgba(120,120,128,.38)}
.gc-icon:active{transform:scale(.9)}
.gc-tile{
  flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;
  font-family:var(--emoji);font-size:18px;line-height:1;background:var(--fill);
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.14);animation:gc-tile-in .5s var(--spring) both;
}
.gc-tile.big{width:56px;height:56px;border-radius:18px;font-size:30px;animation:none}
@keyframes gc-tile-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.gc-title{min-width:0}
.gc-t1{font-size:15px;font-weight:600;letter-spacing:-.015em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-t2{font-size:12px;color:var(--label2);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-dot{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--label3);vertical-align:1px}
.gc-dot.live{background:#30d158;animation:gc-ping 2.4s ease-out infinite}
.gc-dot.connecting{background:#ff9f0a}
@keyframes gc-ping{0%{box-shadow:0 0 0 0 rgba(48,209,88,.45)}70%,100%{box-shadow:0 0 0 7px rgba(48,209,88,0)}}

.gc-seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:2px;border-radius:999px;background:rgba(118,118,128,.24)}
.gc-seg button{
  position:relative;z-index:1;border:0;background:none;cursor:pointer;padding:5px 16px;
  font-size:13px;font-weight:500;letter-spacing:-.01em;color:var(--label2);transition:color .3s;
}
.gc-seg button.active{color:var(--label);font-weight:600}
.gc-thumb{
  position:absolute;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:999px;
  background:rgba(99,99,102,.62);box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 .5px 0 rgba(255,255,255,.18);
  transform:translateX(100%);
}

.gc-rooms{
  grid-column:1 / -1;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;margin:0 -16px;padding:0 16px 2px;
  scrollbar-width:none;overscroll-behavior-x:contain;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%);
}
.gc-rooms::-webkit-scrollbar{display:none}
.gc-rchip{
  flex:none;display:inline-flex;align-items:center;gap:6px;max-width:180px;height:30px;padding:0 12px;
  border:0;border-radius:999px;cursor:pointer;background:rgba(120,120,128,.2);color:var(--label2);
  font-size:13px;font-weight:550;letter-spacing:-.01em;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.08);
  transition:background .3s var(--ease),color .3s,transform .35s var(--spring);
}
.gc-rchip:hover{background:rgba(120,120,128,.32);color:var(--label)}
.gc-rchip:active{transform:scale(.95)}
.gc-rchip.on{background:rgba(255,255,255,.92);color:#1d1d1f;box-shadow:none}
.gc-rchip-ic{font-family:var(--emoji);font-size:14px;line-height:1}
.gc-rchip-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-rchip.add{background:transparent;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.22);color:var(--label)}

.gc-swatch{display:block;width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.35)}
.gc-swatch.big{width:16px;height:16px}
.gc-pop{
  position:absolute;right:0;top:calc(100% + 10px);z-index:10;width:210px;padding:6px;border-radius:18px;
  background:rgba(44,44,46,.72);
  -webkit-backdrop-filter:blur(40px) saturate(190%);backdrop-filter:blur(40px) saturate(190%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.16),0 24px 50px -12px rgba(0,0,0,.6);
  transform-origin:top right;transform:scale(.88);opacity:0;pointer-events:none;
  transition:transform .4s var(--spring),opacity .2s;
}
.gc-pop.open{transform:none;opacity:1;pointer-events:auto}
.gc-pop button{
  width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;border-radius:12px;
  background:none;cursor:pointer;text-align:left;font-size:14px;transition:background .2s;
}
.gc-pop button:hover{background:rgba(255,255,255,.08)}
.gc-pop-name{flex:1}

.gc-list{
  position:absolute;inset:0;z-index:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  padding:calc(var(--hh) + 8px) 14px calc(var(--ch) + 12px);
  -webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent;
}
.gc-inner{max-width:720px;margin:0 auto;display:flex;flex-direction:column;min-height:100%}
.gc-top{height:1px;flex:none}
.gc-begin,.gc-older{align-self:center;display:flex;align-items:center;gap:10px;margin:14px 0 4px;font-size:12px;color:var(--label3)}
.gc-older button{border:0;background:none;color:var(--label);font-size:12px;font-weight:600;cursor:pointer;padding:2px 4px}
.gc-day{display:flex;flex-direction:column;align-items:stretch;gap:3px}
.gc-daypill{
  position:sticky;top:calc(var(--hh) + 8px);z-index:2;align-self:center;margin:16px 0 6px;
  padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;color:var(--label2);
  background:rgba(60,60,64,.55);
  -webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%);
  box-shadow:inset 0 0 0 .5px rgba(255,255,255,.1);
}

.gc-row{display:flex;flex:0 0 auto;align-items:flex-end;gap:8px;margin:0;min-width:0}
.gc-row.first{margin-top:7px}
.gc-row.mine{justify-content:flex-end}
.gc-av-slot{flex:none;width:28px;height:28px}
.gc-av{
  width:28px;height:28px;border-radius:50%;display:grid;place-items:center;
  font-size:12px;font-weight:600;color:#fff;
  background:linear-gradient(160deg,var(--tint),color-mix(in srgb,var(--tint) 50%,#000));
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.35);
}
.gc-col{display:flex;flex:0 1 auto;flex-direction:column;min-width:0;max-width:min(78%,520px)}
.gc-row.mine .gc-col{align-items:flex-end}
.gc-name{margin:0 0 3px 12px;font-size:11.5px;font-weight:500;color:var(--label3)}

.gc-line{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%}
.gc-row.mine .gc-line{flex-direction:row-reverse}
.gc-bubble{
  min-width:0;padding:8px 13px;border-radius:19px;font-size:16px;line-height:1.35;letter-spacing:-.01em;
  white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;
  background:var(--fill);color:var(--label);transform-origin:bottom left;
  transition:opacity .3s,background .4s var(--ease),color .4s var(--ease);
}
.gc-row.mine .gc-bubble{background:var(--accent);color:var(--accent-ink);transform-origin:bottom right}
.gc-row:not(.first):not(.mine) .gc-bubble{border-top-left-radius:6px}
.gc-row:not(.last):not(.mine) .gc-bubble{border-bottom-left-radius:6px}
.gc-row:not(.first).mine .gc-bubble{border-top-right-radius:6px}
.gc-row:not(.last).mine .gc-bubble{border-bottom-right-radius:6px}
.gc-bubble.fresh{animation:gc-pop .5s var(--spring) both}
.gc-bubble.sending{opacity:.55}
@keyframes gc-pop{from{opacity:0;transform:translateY(10px) scale(.86)}to{opacity:1;transform:none}}

.gc-addr{
  flex:none;width:28px;height:28px;border:0;border-radius:50%;cursor:pointer;
  display:grid;place-items:center;background:rgba(120,120,128,.22);color:var(--label2);
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.12);
  opacity:0;transform:scale(.8);
  transition:opacity .2s,transform .35s var(--spring),background .2s,color .2s;
}
.gc-row:hover .gc-addr,.gc-row:focus-within .gc-addr,.gc-addr[aria-expanded="true"]{opacity:1;transform:none}
.gc-addr:hover{background:rgba(120,120,128,.4);color:var(--label)}
.gc-addr:active{transform:scale(.88)}
@media (hover:none){.gc-addr{opacity:.6;transform:none}}

.gc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;max-width:100%}
.gc-row.mine .gc-chips{justify-content:flex-end}
.gc-chip{
  display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:0;border-radius:999px;cursor:pointer;
  background:rgba(120,120,128,.22);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.14);
  color:var(--label);font-family:var(--emoji);font-size:14px;line-height:1;
  animation:gc-chip-in .4s var(--spring) backwards;
  transition:background .25s,box-shadow .25s,transform .3s var(--spring);
}
.gc-chip:hover{background:rgba(120,120,128,.34)}
.gc-chip:active{transform:scale(.92)}
.gc-chip.on{
  background:color-mix(in srgb,var(--accent) 26%,transparent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 75%,transparent);
}
.gc-chip:disabled{cursor:default;opacity:.55}
.gc-chip-n{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;font-size:12px;font-weight:600;color:var(--label2);font-variant-numeric:tabular-nums}
@keyframes gc-chip-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}

.gc-own-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:5px}
.gc-own-actions button{border:0;background:none;padding:2px 0;color:var(--label2);font-size:12px;font-weight:600;cursor:pointer}
.gc-own-actions button:hover{color:var(--label);text-decoration:underline;text-underline-offset:2px}
.gc-edit-input{display:block;width:min(420px,62vw);min-height:42px;max-height:120px;resize:vertical;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:7px 9px;background:rgba(0,0,0,.15);color:inherit;font:inherit;outline:none}
.gc-edit-input:focus{border-color:rgba(255,255,255,.55)}
.gc-meta{margin:3px 4px 0;font-size:11px;color:var(--label3);font-variant-numeric:tabular-nums}
.gc-meta.bad{color:#ff453a}
.gc-meta button{margin-left:8px;border:0;background:none;padding:0;font-size:11px;font-weight:600;color:var(--label);cursor:pointer;text-decoration:underline;text-underline-offset:2px}

.gc-rback{position:fixed;inset:0;z-index:30}
.gc-rback.dim{background:rgba(0,0,0,.4);animation:gc-fade .3s var(--ease)}
@keyframes gc-fade{from{opacity:0}to{opacity:1}}
.gc-glass{
  background:rgba(44,44,46,.78);
  -webkit-backdrop-filter:blur(40px) saturate(190%);backdrop-filter:blur(40px) saturate(190%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.16),inset 0 .5px 0 rgba(255,255,255,.14),0 24px 50px -12px rgba(0,0,0,.65);
}
.gc-rpop{
  position:fixed;z-index:31;top:0;left:0;max-width:calc(100vw - 16px);
  display:flex;flex-direction:column;align-items:center;gap:8px;
  opacity:0;pointer-events:none;transform:scale(.88);
  transition:opacity .18s,transform .45s var(--spring);
}
.gc-rpop[data-ready]{opacity:1;pointer-events:auto;transform:none}

.gc-q{display:flex;align-items:center;gap:2px;padding:5px;border-radius:999px}
.gc-q-btn{
  width:38px;height:38px;border:0;border-radius:50%;cursor:pointer;background:none;
  display:grid;place-items:center;font-family:var(--emoji);font-size:22px;line-height:1;
  animation:gc-q-in .45s var(--spring) backwards;animation-delay:calc(var(--i) * 28ms);
  transition:transform .3s var(--spring),background .2s;
}
.gc-q-btn:hover{transform:translateY(-3px) scale(1.22)}
.gc-q-btn:active{transform:scale(.9)}
.gc-q-btn.on{background:color-mix(in srgb,var(--accent) 28%,transparent)}
@keyframes gc-q-in{from{opacity:0;transform:translateY(8px) scale(.5)}to{opacity:1;transform:none}}
.gc-q-sep{width:.5px;height:22px;margin:0 4px;background:rgba(255,255,255,.16)}
.gc-q-more{
  width:32px;height:32px;margin-right:2px;border:0;border-radius:50%;cursor:pointer;
  display:grid;place-items:center;background:rgba(120,120,128,.3);color:var(--label);
  transition:transform .35s var(--spring),background .2s;
}
.gc-q-more:hover{background:rgba(120,120,128,.46)}
.gc-q-more:active{transform:scale(.9)}

.gc-menu{width:224px;padding:5px;border-radius:18px;animation:gc-menu-in .4s var(--spring) .06s backwards}
@keyframes gc-menu-in{from{opacity:0;transform:translateY(-6px) scale(.94)}to{opacity:1;transform:none}}
.gc-menu button{
  width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:0;border-radius:12px;
  background:none;cursor:pointer;font-size:15px;text-align:left;transition:background .2s;
}
.gc-menu button:hover,.gc-menu button:focus-visible{background:rgba(255,255,255,.09)}
.gc-menu button.danger{color:#ff453a}
.gc-menu button:disabled{opacity:.4;cursor:default}
.gc-menu button + button{margin-top:1px}

.gc-full{position:relative;width:min(340px,calc(100vw - 16px));height:min(400px,calc(100dvh - 16px));border-radius:22px;overflow:hidden}
.gc-full-load{position:absolute;inset:0;display:grid;place-items:center}
.gc-full .EmojiPickerReact{
  --epr-bg-color:transparent;--epr-category-label-bg-color:rgba(44,44,46,.92);
  --epr-text-color:#f5f5f7;--epr-picker-border-color:transparent;--epr-picker-border-radius:0px;
  --epr-search-input-bg-color:rgba(120,120,128,.24);--epr-search-input-bg-color-active:rgba(120,120,128,.32);
  --epr-search-border-color:transparent;--epr-highlight-color:var(--accent);
  --epr-hover-bg-color:rgba(255,255,255,.1);--epr-focus-bg-color:rgba(255,255,255,.14);
  --epr-emoji-size:24px;border:0!important;
}
.gc-rpop.sheet{
  left:0!important;right:0;top:auto!important;bottom:0;width:100%;max-width:none;
  transform:translateY(100%);opacity:1;transition:transform .5s var(--ease);
}
.gc-rpop.sheet[data-ready]{transform:none}
.gc-rpop.sheet .gc-full{width:100%;height:min(420px,62dvh);border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom)}

.gc-state{
  position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;padding:0 32px;text-align:center;pointer-events:none;
}
.gc-s1{font-size:17px;font-weight:600;letter-spacing:-.02em}
.gc-s2{max-width:300px;font-size:14px;line-height:1.4;color:var(--label2)}
.gc-btn{
  pointer-events:auto;margin-top:12px;padding:8px 18px;border:0;border-radius:999px;cursor:pointer;
  background:var(--fill);font-size:14px;font-weight:600;transition:transform .35s var(--spring),background .25s;
}
.gc-btn:hover{background:rgba(120,120,128,.4)}
.gc-btn:active{transform:scale(.94)}

.gc-spin{position:relative;display:inline-block;width:20px;height:20px;flex:none}
.gc-spin i{
  position:absolute;left:50%;top:0;width:2px;height:5.5px;margin-left:-1px;border-radius:1px;
  background:var(--label2);transform-origin:50% 10px;opacity:.15;animation:gc-spoke 1s linear infinite;
}
@keyframes gc-spoke{0%{opacity:1}100%{opacity:.15}}

.gc-jump{
  position:absolute;left:50%;bottom:calc(var(--ch) + 12px);z-index:3;display:flex;align-items:center;gap:6px;
  padding:7px 14px;border:0;border-radius:999px;cursor:pointer;font-size:13px;font-weight:600;
  background:rgba(60,60,64,.6);
  -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.18),0 8px 24px -8px rgba(0,0,0,.6);
  transform:translate(-50%,12px) scale(.9);opacity:0;pointer-events:none;
  transition:transform .5s var(--spring),opacity .25s;
}
.gc-jump.on{transform:translate(-50%,0) scale(1);opacity:1;pointer-events:auto}

.gc-typing{
  position:absolute;left:18px;right:18px;bottom:calc(var(--ch) - 2px);z-index:4;
  max-width:720px;margin:0 auto;padding:0 12px 5px;
  color:var(--label2);font-size:12px;line-height:16px;pointer-events:none;
  animation:gc-fade .18s ease-out;
}
.gc-comp{
  position:absolute;left:0;right:0;bottom:0;z-index:4;
  padding:10px 14px max(12px,env(safe-area-inset-bottom));
  background:rgba(30,30,32,.4);
  -webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
  border-top:.5px solid var(--sep);
}
.gc-capsule{
  position:relative;max-width:720px;margin:0 auto;display:flex;align-items:flex-end;gap:8px;
  padding:5px 5px 5px 16px;border-radius:22px;background:rgba(120,120,128,.2);
  box-shadow:inset 0 0 0 .5px rgba(255,255,255,.12);
  transition:box-shadow .35s var(--ease),background .35s var(--ease);
}
.gc-capsule:focus-within{background:rgba(120,120,128,.3);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.3),0 0 0 4px rgba(255,255,255,.06)}
.gc-input{
  flex:1;min-width:0;max-height:120px;resize:none;border:0;outline:0;background:transparent;
  color:var(--label);font:inherit;font-size:16px;line-height:22px;padding:5px 0;
}
.gc-input::placeholder{color:var(--label3)}
.gc-send{
  flex:none;width:32px;height:32px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;
  background:var(--accent);color:var(--accent-ink);
  transform:scale(.3);opacity:0;pointer-events:none;
  transition:transform .5s var(--spring),opacity .2s,background .4s var(--ease),color .4s var(--ease);
}
.gc-send.on{transform:scale(1);opacity:1;pointer-events:auto}
.gc-send.on:active{transform:scale(.86)}
.gc-count{max-width:720px;margin:4px auto 0;padding-right:10px;text-align:right;font-size:11px;color:var(--label3);font-variant-numeric:tabular-nums}
.gc-count[data-warn="true"]{color:#ff453a}

.gc-toast{
  position:absolute;top:calc(var(--hh) + 12px);left:50%;z-index:25;max-width:calc(100% - 32px);
  padding:9px 16px;border-radius:999px;font-size:13px;font-weight:550;text-align:center;pointer-events:none;
  background:rgba(60,60,64,.86);
  -webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.18),0 12px 30px -10px rgba(0,0,0,.6);
  opacity:0;transform:translate(-50%,-8px) scale(.94);
  transition:opacity .25s,transform .5s var(--spring);
}
.gc-toast.on{opacity:1;transform:translate(-50%,0) scale(1)}

.gc-sheet-wrap{
  position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  animation:gc-fade .25s var(--ease);
}
.gc-sheet{
  width:min(520px,100%);max-height:90%;display:flex;flex-direction:column;
  border-radius:26px 26px 0 0;background:rgba(40,40,43,.92);
  -webkit-backdrop-filter:blur(40px) saturate(190%);backdrop-filter:blur(40px) saturate(190%);
  box-shadow:0 0 0 .5px rgba(255,255,255,.14),inset 0 .5px 0 rgba(255,255,255,.12),0 -20px 60px rgba(0,0,0,.5);
  animation:gc-sheet-in .55s var(--ease);
}
@keyframes gc-sheet-in{from{transform:translateY(36%);opacity:0}to{transform:none;opacity:1}}
.gc-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px}
.gc-sheet-head h2{margin:0;font-size:17px;font-weight:650;letter-spacing:-.02em}
.gc-sheet-body{overflow-y:auto;overscroll-behavior:contain;padding:6px 18px max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
.gc-sheet h3{margin:0;font-size:19px;font-weight:650;letter-spacing:-.02em}

.gc-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;padding:2px;border-radius:12px;background:rgba(118,118,128,.24)}
.gc-tabs button{border:0;border-radius:10px;padding:7px 10px;background:none;cursor:pointer;font-size:14px;font-weight:550;color:var(--label2);transition:background .3s var(--ease),color .3s}
.gc-tabs button.on{background:rgba(99,99,102,.7);color:var(--label);box-shadow:0 2px 6px rgba(0,0,0,.3),inset 0 .5px 0 rgba(255,255,255,.16)}

.gc-form{display:flex;flex-direction:column;gap:14px}
.gc-field{display:flex;flex-direction:column;gap:6px}
.gc-label{font-size:12px;font-weight:600;color:var(--label2);padding-left:2px}
.gc-hint{margin:0;font-size:12.5px;line-height:1.4;color:var(--label2)}
.gc-desc{margin:0;font-size:15px;line-height:1.4}
.gc-err{font-size:13px;color:#ff453a}
.gc-fi{
  width:100%;border:0;border-radius:12px;padding:11px 13px;background:rgba(120,120,128,.24);color:var(--label);
  font:inherit;font-size:16px;outline:0;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.1);
  transition:background .25s,box-shadow .25s;
}
.gc-fi::placeholder{color:var(--label3)}
.gc-fi:focus{background:rgba(120,120,128,.32);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.3)}
.gc-icons{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.gc-ic{height:42px;border:0;border-radius:12px;cursor:pointer;background:rgba(120,120,128,.2);font-family:var(--emoji);font-size:22px;line-height:1;transition:transform .3s var(--spring),background .2s,box-shadow .2s}
.gc-ic:hover{background:rgba(120,120,128,.34)}
.gc-ic:active{transform:scale(.9)}
.gc-ic.on{background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.7)}

.gc-primary{
  height:46px;border:0;border-radius:14px;cursor:pointer;background:var(--accent);color:var(--accent-ink);
  font-size:16px;font-weight:600;letter-spacing:-.01em;transition:transform .35s var(--spring),opacity .2s;
}
.gc-primary:active:not(:disabled){transform:scale(.97)}
.gc-primary:disabled{opacity:.4;cursor:default}
.gc-soft{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 16px;border:0;border-radius:12px;cursor:pointer;
  background:rgba(120,120,128,.26);font-size:14px;font-weight:600;transition:transform .3s var(--spring),background .2s,opacity .2s;
}
.gc-soft:hover:not(:disabled){background:rgba(120,120,128,.4)}
.gc-soft:active:not(:disabled){transform:scale(.97)}
.gc-soft:disabled{opacity:.4;cursor:default}
.gc-soft.wide{width:100%}
.gc-soft.danger{color:#ff453a}
.gc-btnrow{display:flex;gap:8px}
.gc-btnrow .gc-soft{flex:1}
.gc-actions{display:flex;flex-direction:column;gap:8px}

.gc-linkform{display:flex;gap:8px}
.gc-linkform .gc-fi{flex:1;min-width:0}
.gc-list-h{font-size:13px;font-weight:600;color:var(--label2);padding-left:2px}
.gc-center{display:grid;place-items:center;padding:28px 0}
.gc-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 0;text-align:center;color:var(--label2);font-size:14px}
.gc-empty p{margin:0}
.gc-rlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.gc-ritem{
  width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border:0;border-radius:16px;cursor:pointer;text-align:left;
  background:rgba(120,120,128,.18);transition:background .25s,transform .35s var(--spring);
}
.gc-ritem:hover{background:rgba(120,120,128,.3)}
.gc-ritem:active{transform:scale(.985)}
.gc-ritem .gc-tile{animation:none;width:42px;height:42px;font-size:22px;border-radius:14px}
.gc-ritem-body{display:flex;flex-direction:column;min-width:0;flex:1}
.gc-ritem-name{font-size:15px;font-weight:600;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-ritem-desc{font-size:12.5px;color:var(--label2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-ritem-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;font-size:12px;color:var(--label3)}
.gc-ritem-cta{font-size:13px;font-weight:600;color:var(--label)}

.gc-created{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.gc-created .gc-hint{max-width:340px}
.gc-created .gc-btnrow,.gc-created .gc-primary,.gc-created .gc-soft.wide{width:100%}
.gc-key{
  width:100%;padding:12px;border-radius:12px;background:rgba(0,0,0,.28);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.1);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.4;word-break:break-all;user-select:all;text-align:left;
}
.gc-key.sm{padding:9px 11px;font-size:12px;flex:1;min-width:0}
.gc-linkrow{display:flex;gap:8px;align-items:stretch}
.gc-info-top{display:flex;align-items:center;gap:14px}

.gc-delete-backdrop{
  position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;
  padding:20px;background:rgba(0,0,0,.48);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  animation:gc-fade .18s ease-out;
}
.gc-delete-dialog{
  width:min(360px,100%);padding:22px;border-radius:24px;
  background:rgba(42,42,45,.96);border:.5px solid rgba(255,255,255,.14);
  box-shadow:0 24px 70px rgba(0,0,0,.55);animation:gc-delete-in .24s var(--spring);
}
.gc-delete-dialog h2{margin:0;font-size:17px;font-weight:650;letter-spacing:-.02em}
.gc-delete-dialog p{margin:9px 0 22px;font-size:14px;line-height:1.45;color:var(--label2)}
.gc-delete-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.gc-delete-actions button{border:0;border-radius:999px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .2s,background .2s}
.gc-delete-actions button:active{transform:scale(.96)}
.gc-delete-cancel{background:rgba(120,120,128,.24)}
.gc-delete-cancel:hover{background:rgba(120,120,128,.38)}
.gc-delete-confirm{background:#ff453a;color:#fff!important}
.gc-delete-confirm:hover{background:#ff6259}
@keyframes gc-delete-in{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
.gc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@media (max-width:640px){
  .gc-root{padding:0}
  .gc-window{width:100%;height:100%;border-radius:0}
  .gc-window::after{display:none}
  .gc-head{
    grid-template-columns:1fr auto;
    padding:max(12px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 8px max(14px,env(safe-area-inset-left));
  }
  .gc-right{grid-column:2}
  .gc-seg{grid-column:1 / -1;order:3}
  .gc-seg button{padding:6px 0}
  .gc-rooms{order:4;margin:0 calc(-1 * max(14px,env(safe-area-inset-right))) 0 calc(-1 * max(14px,env(safe-area-inset-left)));padding:0 14px 2px}
  .gc-list{padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
  .gc-col{max-width:82%}
  .gc-sheet{width:100%}
}

@media (prefers-reduced-motion:reduce){
  .gc-root *,.gc-root *::before,.gc-root *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
  .gc-spin i{animation:none;opacity:.6}
}
`;
