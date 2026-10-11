import React, {

  useCallback,

  useEffect,

  useLayoutEffect,

  useRef,

  useState,

} from "react";



const API_BASE = (

  import.meta.env.VITE_API_URL ??

  (import.meta.env.DEV ? "http\://localhost:3000" : "")

).replace(/\/$/, "");



const REQUEST_TIMEOUT_MS = 30000;

const MAX_LENGTH = 2000;

const THEME_STORAGE_KEY = "rigidx-theme";

const DEFAULT_THEME = "spaceBlack";



const THEMES = {

  spaceBlack: { name: "Space Black", bubble: "#f5f5f7", text: "#1d1d1f" },

  deepSlate: { name: "Deep Slate", bubble: "#46627f", text: "#ffffff" },

  graphite: { name: "Graphite", bubble: "#58585d", text: "#ffffff" },

  titanium: { name: "Titanium", bubble: "#c9c4ba", text: "#1d1d1f" },

};



const TIME_FORMAT = new Intl.DateTimeFormat([], {

  hour: "numeric",

  minute: "2-digit",

});



const finePointer = () =>

  typeof window !== "undefined" &&

  !!window.matchMedia?.("(pointer: fine)").matches;



const prefersReducedMotion = () =>

  typeof window !== "undefined" &&

  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;



const isEditable = (el) =>

  !!el &&

  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));



const readStoredTheme = () => {

  try {

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    return stored && THEMES[stored] ? stored : DEFAULT_THEME;

  } catch {

    return DEFAULT_THEME;

  }

};



const Svg = ({ children, size = 18, stroke = 1.8, ...rest }) => (

  <svg

    viewBox="0 0 20 20"

    width={size}

    height={size}

    fill="none"

    stroke="currentColor"

    strokeWidth={stroke}

    strokeLinecap="round"

    strokeLinejoin="round"

    aria-hidden="true"

    {...rest}

  >

    {children}

  </svg>

);



const ArrowUpIcon = () => (

  <Svg size={16} stroke={2.4}>

    <path d="M10 16V4.5M4.8 9.5 10 4.3l5.2 5.2" />

  </Svg>

);

const LockIcon = ({ size = 18 }) => (

  <Svg size={size}>

    <rect x="4" y="9" width="12" height="8" rx="2.4" />

    <path d="M6.8 9V6.6a3.2 3.2 0 0 1 6.4 0V9" />

  </Svg>

);

const SidebarIcon = () => (

  <Svg>

    <rect x="2.5" y="4" width="15" height="12" rx="3.2" />

    <path d="M8 4v12" />

  </Svg>

);

const CloseIcon = () => (

  <Svg size={16} stroke={2}>

    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />

  </Svg>

);

const SkipIcon = () => (

  <Svg size={15} stroke={2}>

    <path d="M4.5 5l5 5-5 5M10.5 5l5 5-5 5" />

  </Svg>

);



function BrandMark() {

  const [failed, setFailed] = useState(false);

  return (

    <span className="rx-brand-tile" aria-hidden="true">

      {failed ? (

        <span className="rx-brand-fallback">r</span>

      ) : (

        <img src="/logo.png" alt="" onError={() => setFailed(true)} />

      )}

    </span>

  );

}



function Sidebar({ themeKey, onThemeChange }) {

  const active = THEMES[themeKey] || THEMES[DEFAULT_THEME];



  return (

    <div className="rx-side">

      <div>

        <div className="rx-brand">

          <BrandMark />

          <div>

            <b>rigid</b>

            <span>X</span>

          </div>

        </div>



        <section className="rx-section">

          <h3 className="rx-section-title">Appearance</h3>

          <div className="rx-group">

            <div className="rx-group-row">

              <span>Finish</span>

              <span key={active.name} className="rx-group-value rx-fade-in">

                {active.name}

              </span>

            </div>

            <div

              className="rx-swatches"

              role="radiogroup"

              aria-label="Message finish"

            >

              {Object.entries(THEMES).map(([key, theme]) => (

                <button

                  key={key}

                  type="button"

                  role="radio"

                  aria-checked={themeKey === key}

                  aria-label={theme.name}

                  title={theme.name}

                  className="rx-swatch"

                  data-active={themeKey === key}

                  style={{ "--sw": theme.bubble }}

                  onClick={() => onThemeChange(key)}

                />

              ))}

            </div>

          </div>

        </section>



        <section className="rx-section">

          <h3 className="rx-section-title">Connection</h3>

          <div className="rx-group">

            <div className="rx-group-row">

              <span className="rx-inline">

                <LockIcon size={16} />

                Encrypted

              </span>

              <span className="rx-group-value">

                <i className="rx-live-dot" />

                On

              </span>

            </div>

          </div>

        </section>

      </div>



      <div className="rx-user">

        <div className="rx-avatar rx-avatar-flat" aria-hidden="true">

          ID

        </div>

        <div className="min-w-0">

          <p className="rx-user-name truncate">Anonymous User</p>

          <p className="rx-user-sub truncate">Secure channel</p>

        </div>

      </div>

    </div>

  );

}



const ChatPage = ({ onLeave }) => {

  const [isClosing, setIsClosing] = useState(false);

  const [themeKey, setThemeKey] = useState(readStoredTheme);

  const [messages, setMessages] = useState(() => [

    { id: 0, sender: "stranger", text: "Hello.", ts: Date.now() },

  ]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);

  const [finding, setFinding] = useState(false);

  const [skipOpen, setSkipOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [scrolled, setScrolled] = useState(false);



  const windowRef = useRef(null);

  const scrollRef = useRef(null);

  const inputRef = useRef(null);

  const cancelRef = useRef(null);

  const confirmRef = useRef(null);



  const nextId = useRef(1);

  const stickRef = useRef(true);

  const abortRef = useRef(null);

  const lastRequestRef = useRef(null);

  const lastEnterRef = useRef(0);

  const leavingRef = useRef(false);

  const leaveTimer = useRef(null);

  const skipTimer = useRef(null);

  const onLeaveRef = useRef(onLeave);



  const activeTheme = THEMES[themeKey] || THEMES[DEFAULT_THEME];

  const hasText = input.trim().length > 0;

  const canSend = hasText && !loading && !finding;



  useEffect(() => {

    onLeaveRef.current = onLeave;

  }, [onLeave]);



  useEffect(() => {

    try {

      window.localStorage.setItem(THEME_STORAGE_KEY, themeKey);

    } catch {

    }

  }, [themeKey]);



  useEffect(() => {

    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {

      document.body.style.overflow = previous;

    };

  }, []);



  useEffect(

    () => () => {

      abortRef.current?.abort();

      clearTimeout(leaveTimer.current);

      clearTimeout(skipTimer.current);

    },

    []

  );



  const focusInput = useCallback((delay = 0) => {

    if (!finePointer()) return;

    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), delay);

  }, []);



  useEffect(() => {

    focusInput(380);

  }, [focusInput]);



  const leave = useCallback(() => {

    if (leavingRef.current) return;

    leavingRef.current = true;

    abortRef.current?.abort();

    setSkipOpen(false);

    setMenuOpen(false);

    setIsClosing(true);

    leaveTimer.current = setTimeout(() => onLeaveRef.current?.(), 300);

  }, []);



  const openSkip = useCallback(() => {

    if (finding) return;

    setMenuOpen(false);

    setSkipOpen(true);

  }, [finding]);



  const closeSkip = useCallback(() => {

    setSkipOpen(false);

    focusInput(60);

  }, [focusInput]);



  useEffect(() => {

    if (!skipOpen) return undefined;

    const t = setTimeout(() => cancelRef.current?.focus(), 40);

    return () => clearTimeout(t);

  }, [skipOpen]);



  useEffect(() => {

    const onKeyDown = (e) => {

      if (e.isComposing) return;



      if (e.key === "Escape") {

        e.preventDefault();

        if (skipOpen) closeSkip();

        else if (menuOpen) setMenuOpen(false);

        else leave();

        return;

      }



      if (e.key === "/" && !skipOpen && !isEditable(e.target)) {

        e.preventDefault();

        inputRef.current?.focus();

      }

    };



    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [skipOpen, menuOpen, closeSkip, leave]);



  const appendMessage = useCallback((message) => {

    const id = nextId.current++;

    setMessages((prev) => [...prev, { id, ts: Date.now(), ...message }]);

  }, []);



  const requestReply = useCallback(

    async (text, history) => {

      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;

      lastRequestRef.current = { text, history };

      setLoading(true);



      let timedOut = false;

      const timeout = setTimeout(() => {

        timedOut = true;

        controller.abort();

      }, REQUEST_TIMEOUT_MS);



      try {

        const response = await fetch(`${API_BASE}/api/chat`, {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ message: text, history }),

          signal: controller.signal,

        });



        if (!response.ok) throw new Error(`API error: ${response.status}`);



        const data = await response.json();

        if (typeof data.reply !== "string" || !data.reply) {

          throw new Error("Invalid API response");

        }



        await new Promise((resolve) =>

          setTimeout(resolve, 300 + Math.random() * 400)

        );

        if (controller.signal.aborted) return;



        appendMessage({ sender: "stranger", text: data.reply });

      } catch (error) {



        if (controller.signal.aborted && !timedOut) return;

        console.error("Chat error:", error);

        appendMessage({ kind: "error" });

      } finally {

        clearTimeout(timeout);

        if (abortRef.current === controller) {

          abortRef.current = null;

          setLoading(false);

          focusInput(40);

        }

      }

    },

    [appendMessage, focusInput]

  );



  const sendMessage = () => {

    const text = input.trim();

    if (!text || loading || finding) return;



    const history = messages

      .filter((m) => !m.kind)

      .map((m) => ({

        role: m.sender === "you" ? "user" : "assistant",

        content: m.text,

      }));



    const id = nextId.current++;

    stickRef.current = true;

    setInput("");

    setMessages((prev) => [

      ...prev.filter((m) => m.kind !== "error"),

      { id, sender: "you", text, ts: Date.now() },

    ]);

    requestReply(text, history);

  };



  const retry = () => {

    const last = lastRequestRef.current;

    if (!last || loading) return;

    stickRef.current = true;

    setMessages((prev) => prev.filter((m) => m.kind !== "error"));

    requestReply(last.text, last.history);

  };



  const skipStranger = () => {

    if (finding) return;

    setSkipOpen(false);

    abortRef.current?.abort();

    abortRef.current = null;

    lastRequestRef.current = null;

    stickRef.current = true;

    setLoading(false);

    setInput("");

    setScrolled(false);

    setFinding(true);



    clearTimeout(skipTimer.current);

    skipTimer.current = setTimeout(() => {

      setMessages([

        {

          id: nextId.current++,

          sender: "stranger",

          text: "Hello.",

          ts: Date.now(),

        },

      ]);

      setFinding(false);

      focusInput(140);

    }, 1400);

  };



  useLayoutEffect(() => {

    const el = inputRef.current;

    if (!el) return;

    el.style.height = "auto";

    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;

  }, [input, finding]);



  const onInputKeyDown = (e) => {

    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;

    e.preventDefault();



    if (hasText) {

      sendMessage();

      return;

    }



    const now = performance.now();

    if (now - lastEnterRef.current < 500) {

      lastEnterRef.current = 0;

      openSkip();

    } else {

      lastEnterRef.current = now;

    }

  };



  const onScroll = () => {

    const el = scrollRef.current;

    if (!el) return;

    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;

    const next = el.scrollTop > 2;

    setScrolled((prev) => (prev === next ? prev : next));

  };



  useLayoutEffect(() => {

    const el = scrollRef.current;

    if (!el || !stickRef.current) return;

    el.scrollTo({

      top: el.scrollHeight,

      behavior: prefersReducedMotion() ? "auto" : "smooth",

    });

  }, [messages, loading, finding]);



  const onPointerMove = (e) => {

    if (e.pointerType !== "mouse") return;

    const el = windowRef.current;

    if (!el) return;

    const rect = el.getBoundingClientRect();

    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);

    el.style.setProperty("--my", `${e.clientY - rect.top}px`);

  };



  const onAlertKeyDown = (e) => {

    if (e.key !== "Tab") return;

    const first = cancelRef.current;

    const last = confirmRef.current;

    if (e.shiftKey && document.activeElement === first) {

      e.preventDefault();

      last?.focus();

    } else if (!e.shiftKey && document.activeElement === last) {

      e.preventDefault();

      first?.focus();

    }

  };



  const lastMessage = messages[messages.length - 1];

  const status = finding ? "Connecting…" : loading ? "Typing…" : "Connected";



  return (

    <div

      className="rx-root"

      data-closing={isClosing}

      role="dialog"

      aria-modal="true"

      aria-label="rigidX chat"

      style={{

        "--rx-accent": activeTheme.bubble,

        "--rx-accent-fg": activeTheme.text,

      }}

    >

      <style>{STYLES}</style>



      <div className="rx-backdrop" aria-hidden="true" />



      <div ref={windowRef} className="rx-window" onPointerMove={onPointerMove}>

        {}

        <aside className="rx-sidebar">

          <Sidebar themeKey={themeKey} onThemeChange={setThemeKey} />

        </aside>



        {}

        <div

          className="rx-drawer-scrim"

          data-open={menuOpen}

          onClick={() => setMenuOpen(false)}

          aria-hidden="true"

        />

        <div className="rx-drawer" data-open={menuOpen} aria-hidden={!menuOpen}>

          <div className="rx-drawer-head">

            <span>Settings</span>

            <button

              type="button"

              className="rx-icon-btn"

              aria-label="Close settings"

              onClick={() => setMenuOpen(false)}

            >

              <CloseIcon />

            </button>

          </div>

          <div className="min-h-0 flex-1">

            <Sidebar themeKey={themeKey} onThemeChange={setThemeKey} />

          </div>

        </div>



        <main className="rx-main">

          <header className="rx-header" data-scrolled={scrolled}>

            <div className="flex min-w-0 items-center gap-3">

              <button

                type="button"

                className="rx-icon-btn rx-menu-btn"

                aria-label="Open settings"

                onClick={() => setMenuOpen(true)}

              >

                <SidebarIcon />

              </button>



              <div className="rx-peer">

                <div className="rx-avatar" aria-hidden="true">

                  S

                  <span

                    className="rx-presence"

                    data-state={finding ? "idle" : "live"}

                  />

                </div>

                <div className="min-w-0">

                  <h1 className="rx-peer-name">Stranger</h1>

                  <p key={status} className="rx-peer-status rx-fade-in">

                    {status}

                  </p>

                </div>

              </div>

            </div>



            <div className="rx-actions">

              <button

                type="button"

                className="rx-pill"

                onClick={openSkip}

                disabled={finding}

                aria-label="Next stranger"

              >

                <span className="rx-label-wide">Next</span>

                <SkipIcon />

              </button>

              <button

                type="button"

                className="rx-pill"

                data-variant="solid"

                onClick={leave}

              >

                Leave

              </button>

            </div>

          </header>



          {finding ? (

            <div className="rx-finding" role="status">

              <div className="rx-spinner" aria-hidden="true">

                {Array.from({ length: 12 }, (_, i) => (

                  <i key={i} style={{ "--i": i }} />

                ))}

              </div>

              <div>

                <h2>Finding a peer</h2>

                <p>Opening a private channel</p>

              </div>

            </div>

          ) : (

            <>

              <div ref={scrollRef} className="rx-scroll" onScroll={onScroll}>

                <div className="rx-thread" role="log" aria-label="Messages">

                  {messages.length === 1 && (

                    <div className="rx-intro">

                      <div className="rx-intro-icon" style={{ animationDelay: "120ms" }}>

                        <LockIcon size={22} />

                      </div>

                      <h2 style={{ animationDelay: "180ms" }}>Private session</h2>

                      <p style={{ animationDelay: "240ms" }}>

                        Messages are transient and encrypted. Say something to

                        begin.

                      </p>

                    </div>

                  )}



                  {messages.map((msg, i) => {

                    if (msg.kind === "error") {

                      return (

                        <div key={msg.id} className="rx-notice" role="alert">

                          <span>Connection lost.</span>

                          <button type="button" onClick={retry} disabled={loading}>

                            Try again

                          </button>

                        </div>

                      );

                    }



                    const prev = messages[i - 1];

                    const next = messages[i + 1];

                    const side = msg.sender === "you" ? "you" : "peer";

                    const first = !prev || prev.kind === "error" || prev.sender !== msg.sender;

                    const last = !next || next.kind === "error" || next.sender !== msg.sender;



                    return (

                      <div key={msg.id} className="rx-msg" data-side={side} data-first={first}>

                        <div className="rx-bubble" data-side={side} data-first={first} data-last={last}>

                          {msg.text}

                        </div>

                        {last && (

                          <time className="rx-time" dateTime={new Date(msg.ts).toISOString()}>

                            {TIME_FORMAT.format(msg.ts)}

                          </time>

                        )}

                      </div>

                    );

                  })}



                  {loading && (

                    <div

                      className="rx-msg"

                      data-side="peer"

                      data-first={lastMessage?.sender !== "stranger"}

                    >

                      <div

                        className="rx-bubble rx-typing"

                        data-side="peer"

                        data-first="true"

                        data-last="true"

                        role="status"

                        aria-label="Stranger is typing"

                      >

                        <i />

                        <i />

                        <i />

                      </div>

                    </div>

                  )}

                </div>

              </div>



              <div className="rx-dock">

                <div className="rx-dock-inner">

                  <div className="rx-composer">

                    <textarea

                      ref={inputRef}

                      className="rx-input"

                      rows={1}

                      value={input}

                      maxLength={MAX_LENGTH}

                      placeholder="Message"

                      aria-label="Message"

                      enterKeyHint="send"

                      autoComplete="off"

                      onChange={(e) => setInput(e.target.value)}

                      onKeyDown={onInputKeyDown}

                    />

                    <button

                      type="button"

                      className="rx-send"

                      data-visible={hasText}

                      disabled={!canSend}

                      tabIndex={hasText ? 0 : -1}

                      aria-label="Send message"



                      onPointerDown={(e) => e.preventDefault()}

                      onClick={sendMessage}

                    >

                      <ArrowUpIcon />

                    </button>

                  </div>



                  <div className="rx-hints" aria-hidden="true">

                    <span>

                      <kbd className="rx-kbd">/</kbd> focus

                    </span>

                    <span>

                      <kbd className="rx-kbd">↵</kbd>

                      <kbd className="rx-kbd">↵</kbd> next

                    </span>

                    <span>

                      <kbd className="rx-kbd">esc</kbd> leave

                    </span>

                  </div>

                </div>

              </div>

            </>

          )}

        </main>



        {}

        <div

          className="rx-alert-scrim"

          data-open={skipOpen}

          aria-hidden={!skipOpen}

          onClick={(e) => {

            if (e.target === e.currentTarget) closeSkip();

          }}

        >

          <div

            className="rx-alert"

            role="alertdialog"

            aria-modal="true"

            aria-labelledby="rx-skip-title"

            aria-describedby="rx-skip-desc"

            onKeyDown={onAlertKeyDown}

          >

            <div className="rx-alert-body">

              <h2 id="rx-skip-title">Skip this stranger?</h2>

              <p id="rx-skip-desc">The current chat room will be destroyed.</p>

            </div>

            <div className="rx-alert-actions">

              <button ref={cancelRef} type="button" onClick={closeSkip}>

                Cancel

              </button>

              <button

                ref={confirmRef}

                type="button"

                data-primary="true"

                onClick={skipStranger}

              >

                Skip

              </button>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

};



export default ChatPage;



const STYLES = `

.rx-root {

  \--rx-ease: cubic-bezier(0.32, 0.72, 0, 1);

  \--rx-spring: cubic-bezier(0.34, 1.38, 0.64, 1);

  \--rx-label: rgba(255, 255, 255, 0.94);

  \--rx-label-2: rgba(235, 235, 245, 0.62);

  \--rx-label-3: rgba(235, 235, 245, 0.34);

  \--rx-hairline: rgba(255, 255, 255, 0.1);



  position: fixed;

  inset: 0;

  z-index: 50;

  display: flex;

  align-items: center;

  justify-content: center;

  color: var(--rx-label);

  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",

    "Inter", "Segoe UI", system-ui, sans-serif;

  -webkit-font-smoothing: antialiased;

  text-rendering: optimizeLegibility;

}

@media (min-width: 640px) { .rx-root { padding: 24px; } }

.rx-root *, .rx-root *::before, .rx-root *::after { box-sizing: border-box; }

.rx-root h1, .rx-root h2, .rx-root h3, .rx-root p { margin: 0; font-weight: inherit; }

.rx-root button {

  font: inherit; color: inherit; background: none; border: 0; padding: 0;

  cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;

}

.rx-root button:disabled { cursor: default; }

.rx-root :focus-visible { outline: 2px solid rgba(255, 255, 255, 0.78); outline-offset: 2px; }

.rx-root ::selection { background: rgba(255, 255, 255, 0.22); }

.rx-root[data-closing="true"] * { pointer-events: none; }



@keyframes rx-fade { from { opacity: 0; } }

@keyframes rx-rise { from { opacity: 0; transform: translateY(8px); } }

@keyframes rx-window-in { from { opacity: 0; transform: scale(0.94) translateY(14px); } }

@keyframes rx-sheet-in { from { opacity: 0; transform: translateY(28px); } }

@keyframes rx-msg-in { from { opacity: 0; transform: translateY(10px) scale(0.88); } }

@keyframes rx-dot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }

@keyframes rx-spoke { from { opacity: 1; } to { opacity: 0.14; } }

.rx-fade-in { animation: rx-fade 0.35s ease backwards; }



.rx-backdrop {

  position: absolute; inset: 0;

  background: rgba(0, 0, 0, 0.38);

  -webkit-backdrop-filter: blur(28px) saturate(150%);

  backdrop-filter: blur(28px) saturate(150%);

  animation: rx-fade 0.5s ease backwards;

  transition: opacity 0.3s ease;

}

.rx-root[data-closing="true"] .rx-backdrop { opacity: 0; }



.rx-window {

  position: relative;

  display: flex;

  width: 100%;

  max-width: 1040px;

  height: 100dvh;

  overflow: hidden;

  background: rgba(34, 34, 36, 0.58);

  -webkit-backdrop-filter: blur(60px) saturate(180%);

  backdrop-filter: blur(60px) saturate(180%);

  box-shadow:

    0 0 0 0.5px rgba(255, 255, 255, 0.14),

    inset 0 0.5px 0 rgba(255, 255, 255, 0.22),

    0 40px 100px -20px rgba(0, 0, 0, 0.7),

    0 12px 30px -10px rgba(0, 0, 0, 0.5);

  animation: rx-sheet-in 0.55s var(--rx-ease) backwards;

  transition: opacity 0.26s ease, transform 0.3s var(--rx-ease);

}

@media (min-width: 640px) {

  .rx-window {

    height: min(86dvh, 780px);

    min-height: min(560px, 100dvh);

    border-radius: 28px;

    animation-name: rx-window-in;

    animation-duration: 0.6s;

  }

}

.rx-root[data-closing="true"] .rx-window { opacity: 0; transform: translateY(24px); }

@media (min-width: 640px) {

  .rx-root[data-closing="true"] .rx-window { transform: scale(0.97) translateY(8px); }

}



.rx-window::before {

  content: ""; position: absolute; z-index: 6; top: 0; left: 0; right: 0; height: 1px;

  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34) 50%, transparent);

  pointer-events: none;

}



.rx-window::after {

  content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;

  background: radial-gradient(520px circle at var(--mx, 50%) var(--my, 0%), rgba(255, 255, 255, 0.055), transparent 65%);

  opacity: 0; transition: opacity 0.5s ease;

}

@media (hover: hover) and (pointer: fine) { .rx-window:hover::after { opacity: 1; } }



.rx-sidebar {

  display: none; position: relative; z-index: 2; width: 244px; flex-shrink: 0;

  border-right: 0.5px solid var(--rx-hairline);

  background: rgba(255, 255, 255, 0.025);

}

@media (min-width: 640px) { .rx-sidebar { display: block; } }

.rx-side { display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 20px 16px 16px; }

.rx-brand { display: flex; align-items: center; gap: 10px; padding: 0 4px; font-size: 16px; letter-spacing: -0.025em; }

.rx-brand b { font-weight: 600; }

.rx-brand span { font-weight: 400; color: var(--rx-label-2); }

.rx-brand-tile {

  display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px;

  background: rgba(255, 255, 255, 0.08);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.22), 0 0 0 0.5px rgba(255, 255, 255, 0.1);

}

.rx-brand-tile img { width: 18px; height: 18px; object-fit: contain; mix-blend-mode: screen; }

.rx-brand-fallback { font-size: 15px; font-weight: 600; }

.rx-section { margin-top: 26px; }

.rx-section-title { padding: 0 8px 8px; font-size: 13px; color: var(--rx-label-2); }

.rx-group {

  border-radius: 14px; background: rgba(255, 255, 255, 0.055);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.1), 0 0 0 0.5px rgba(255, 255, 255, 0.07);

}

.rx-group-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 42px; padding: 0 14px; font-size: 14px; letter-spacing: -0.01em; }

.rx-group-value { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; color: var(--rx-label-2); }

.rx-inline { display: inline-flex; align-items: center; gap: 8px; }

.rx-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #30d158; }

.rx-swatches { display: flex; justify-content: space-between; padding: 12px 14px; border-top: 0.5px solid var(--rx-hairline); }

.rx-swatch {

  width: 30px; height: 30px; border-radius: 50%; background: var(--sw);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.35), 0 0 0 0.5px rgba(255, 255, 255, 0.2);

  outline: 2px solid transparent; outline-offset: 2px;

  transition: transform 0.4s var(--rx-spring), outline-color 0.3s ease, outline-offset 0.4s var(--rx-spring);

}

.rx-swatch:hover { transform: scale(1.08); }

.rx-swatch:active { transform: scale(0.92); }

.rx-swatch[data-active="true"] { outline-color: rgba(255, 255, 255, 0.9); outline-offset: 3px; }

.rx-user { display: flex; align-items: center; gap: 11px; padding: 14px 4px 0; border-top: 0.5px solid var(--rx-hairline); }

.rx-user-name { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }

.rx-user-sub { font-size: 12px; color: var(--rx-label-2); }



.rx-drawer-scrim {

  position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.45);

  opacity: 0; visibility: hidden;

  transition: opacity 0.35s ease, visibility 0s linear 0.35s;

}

.rx-drawer-scrim[data-open="true"] { opacity: 1; visibility: visible; transition-delay: 0s; }

.rx-drawer {

  position: absolute; z-index: 21; top: 0; bottom: 0; left: 0; display: flex; flex-direction: column;

  width: min(300px, 86%);

  background: rgba(36, 36, 38, 0.8);

  -webkit-backdrop-filter: blur(40px) saturate(180%);

  backdrop-filter: blur(40px) saturate(180%);

  box-shadow: inset -0.5px 0 0 rgba(255, 255, 255, 0.1), 20px 0 60px rgba(0, 0, 0, 0.4);

  transform: translateX(-102%); visibility: hidden;

  transition: transform 0.5s var(--rx-ease), visibility 0s linear 0.5s;

}

.rx-drawer[data-open="true"] { transform: translateX(0); visibility: visible; transition-delay: 0s; }

@media (min-width: 640px) { .rx-drawer, .rx-drawer-scrim { display: none; } }

.rx-drawer-head {

  display: flex; flex-shrink: 0; align-items: center; justify-content: space-between;

  height: 64px; padding: 0 14px 0 20px; font-size: 17px; font-weight: 600; letter-spacing: -0.022em;

}



.rx-main { position: relative; z-index: 2; display: flex; flex: 1; min-width: 0; flex-direction: column; }

.rx-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  height: 64px;
  padding: 0 16px;
  border-bottom: 0.5px solid transparent;
  transition: border-color 0.3s ease, background-color 0.3s ease;
}

@media (min-width: 640px) { .rx-header { padding: 0 24px; } }

.rx-header[data-scrolled="true"] { border-bottom-color: var(--rx-hairline); background: rgba(255, 255, 255, 0.025); }

.rx-peer { display: flex; align-items: center; gap: 11px; min-width: 0; }

.rx-avatar {

  position: relative; display: grid; place-items: center; flex-shrink: 0;

  width: 36px; height: 36px; border-radius: 50%;

  font-size: 15px; font-weight: 600; color: #fff;

  background: linear-gradient(180deg, #9a9aa1, #68686f);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.4);

}

.rx-avatar-flat { width: 34px; height: 34px; font-size: 12px; background: rgba(255, 255, 255, 0.1); box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.2), 0 0 0 0.5px rgba(255, 255, 255, 0.1); }

.rx-presence {

  position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 50%;

  background: #30d158; box-shadow: 0 0 0 2.5px #262628; transition: background-color 0.4s ease;

}

.rx-presence[data-state="idle"] { background: #8e8e93; }

.rx-peer-name { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }

.rx-peer-status { margin-top: 1px; font-size: 12px; line-height: 1.3; color: var(--rx-label-2); }

.rx-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 12px !important;
  margin-left: auto;
  padding: 0 4px;
}

.rx-actions .rx-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: fit-content;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  white-space: nowrap;
  box-sizing: border-box;
}

.rx-actions .rx-pill + .rx-pill {
  margin-left: 0 !important;
}



.rx-pill, .rx-icon-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 999px;

  font-size: 13px; font-weight: 500; color: var(--rx-label);

  background: rgba(255, 255, 255, 0.08);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.16), 0 0 0 0.5px rgba(255, 255, 255, 0.08);

  transition: background-color 0.25s ease, transform 0.35s var(--rx-spring), opacity 0.25s ease;

}

.rx-pill {
  flex-shrink: 0;
  min-width: 0;
  gap: 6px;
  padding: 0 13px;
  white-space: nowrap;
}

.rx-icon-btn { width: 34px; }

.rx-pill:hover:not(:disabled), .rx-icon-btn:hover { background: rgba(255, 255, 255, 0.14); }

.rx-pill:active:not(:disabled), .rx-icon-btn:active { transform: scale(0.95); }

.rx-pill:disabled { opacity: 0.4; }

.rx-pill[data-variant="solid"] { color: #1d1d1f; background: #f5f5f7; box-shadow: none; font-weight: 600; }

.rx-pill[data-variant="solid"]:hover:not(:disabled) { background: #fff; }

.rx-label-wide { display: none; }

@media (min-width: 440px) { .rx-label-wide { display: inline; } }

.rx-menu-btn { display: inline-flex; }

@media (min-width: 640px) { .rx-menu-btn { display: none; } }



.rx-scroll {

  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;

  padding: 12px 16px 8px;

  scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.18) transparent;

  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);

  mask-image: linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);

}

@media (min-width: 640px) { .rx-scroll { padding: 12px 28px 8px; } }

.rx-thread { display: flex; flex-direction: column; justify-content: flex-end; min-height: 100%; max-width: 620px; margin: 0 auto; }



.rx-intro { margin: auto 0; padding: 24px 16px; text-align: center; }

.rx-intro > * { animation: rx-rise 0.6s var(--rx-ease) backwards; }

.rx-intro-icon {

  display: grid; place-items: center; width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 16px;

  background: rgba(255, 255, 255, 0.07);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.2), 0 0 0 0.5px rgba(255, 255, 255, 0.1);

}

.rx-intro h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.022em; }

.rx-intro p { max-width: 260px; margin: 6px auto 0; font-size: 13px; line-height: 1.45; color: var(--rx-label-2); }



.rx-msg { display: flex; flex-direction: column; animation: rx-msg-in 0.5s var(--rx-spring) backwards; }

.rx-msg[data-side="you"] { align-items: flex-end; transform-origin: 100% 100%; }

.rx-msg[data-side="peer"] { align-items: flex-start; transform-origin: 0 100%; }

.rx-msg[data-first="true"] { margin-top: 12px; }

.rx-msg[data-first="false"] { margin-top: 2px; }

.rx-msg:first-child { margin-top: 0; }



.rx-bubble {

  max-width: min(82%, 460px); padding: 8px 14px; border-radius: 19px;

  font-size: 15px; line-height: 1.36; letter-spacing: -0.012em;

  white-space: pre-wrap; overflow-wrap: anywhere;

  transition: border-radius 0.35s var(--rx-ease), background-color 0.4s ease, color 0.4s ease;

}

.rx-bubble[data-side="peer"] { background: rgba(255, 255, 255, 0.1); box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.14); }

.rx-bubble[data-side="you"] { color: var(--rx-accent-fg); background: var(--rx-accent); box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.3); }

.rx-bubble[data-side="you"][data-first="false"] { border-top-right-radius: 7px; }

.rx-bubble[data-side="you"][data-last="false"] { border-bottom-right-radius: 7px; }

.rx-bubble[data-side="you"][data-last="true"] { border-bottom-right-radius: 5px; }

.rx-bubble[data-side="peer"][data-first="false"] { border-top-left-radius: 7px; }

.rx-bubble[data-side="peer"][data-last="false"] { border-bottom-left-radius: 7px; }

.rx-bubble[data-side="peer"][data-last="true"] { border-bottom-left-radius: 5px; }

.rx-time { margin-top: 4px; padding: 0 6px; font-size: 11px; line-height: 1.2; color: var(--rx-label-3); font-variant-numeric: tabular-nums; }



.rx-typing { display: flex; align-items: center; gap: 4px; padding: 13px 14px; }

.rx-typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--rx-label-2); animation: rx-dot 1.3s ease-in-out infinite; }

.rx-typing i:nth-child(2) { animation-delay: 0.16s; }

.rx-typing i:nth-child(3) { animation-delay: 0.32s; }



.rx-notice {

  align-self: center; display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 6px 6px 6px 14px;

  border-radius: 999px; font-size: 13px; color: var(--rx-label-2);

  background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.12);

  animation: rx-rise 0.45s var(--rx-ease) backwards;

}

.rx-notice button {

  height: 26px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 500; color: var(--rx-label);

  background: rgba(255, 255, 255, 0.1); transition: background-color 0.2s ease, transform 0.3s var(--rx-spring), opacity 0.2s ease;

}

.rx-notice button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); }

.rx-notice button:active:not(:disabled) { transform: scale(0.95); }

.rx-notice button:disabled { opacity: 0.4; }



.rx-finding {

  display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 20px;

  padding: 24px; text-align: center; animation: rx-fade 0.45s ease backwards;

}

.rx-finding h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.022em; }

.rx-finding p { margin-top: 4px; font-size: 13px; color: var(--rx-label-2); }

.rx-spinner { position: relative; width: 30px; height: 30px; }

.rx-spinner i {

  position: absolute; top: 0; left: 50%; width: 2.5px; height: 8px; margin-left: -1.25px; border-radius: 2px;

  background: var(--rx-label); opacity: 0.14; transform-origin: 50% 15px;

  transform: rotate(calc(var(--i) * 30deg));

  animation: rx-spoke 1s linear infinite; animation-delay: calc(var(--i) * 0.0833s - 1s);

}



.rx-dock { flex-shrink: 0; padding: 8px 16px calc(14px + env(safe-area-inset-bottom, 0px)); }

@media (min-width: 640px) { .rx-dock { padding: 8px 28px calc(20px + env(safe-area-inset-bottom, 0px)); } }

.rx-dock-inner { max-width: 620px; margin: 0 auto; }

.rx-composer {

  display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 18px; border-radius: 26px;

  background: rgba(255, 255, 255, 0.07);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.14), 0 0 0 0.5px rgba(255, 255, 255, 0.12);

  transition: background-color 0.3s ease, box-shadow 0.35s var(--rx-ease);

}

.rx-composer:focus-within {

  background: rgba(255, 255, 255, 0.1);

  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.2), 0 0 0 0.5px rgba(255, 255, 255, 0.3), 0 0 0 4px rgba(255, 255, 255, 0.06);

}

.rx-input {

  flex: 1; min-width: 0; max-height: 120px; padding: 5px 0; border: 0; outline: 0; resize: none;

  background: transparent; color: var(--rx-label); caret-color: var(--rx-label);

  font: inherit; font-size: 15px; line-height: 22px; letter-spacing: -0.012em; scrollbar-width: none;

}

.rx-root .rx-input:focus-visible { outline: none; }

.rx-input::placeholder { color: var(--rx-label-3); }

@media (max-width: 639px) { .rx-input { font-size: 16px; } } 

.rx-send {

  display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;

  color: var(--rx-accent-fg); background: var(--rx-accent);

  transform: scale(0.4); opacity: 0; pointer-events: none;

  transition: transform 0.45s var(--rx-spring), opacity 0.2s ease, background-color 0.4s ease, color 0.4s ease;

}

.rx-send[data-visible="true"] { transform: scale(1); opacity: 1; pointer-events: auto; }

.rx-send[data-visible="true"]:active:not(:disabled) { transform: scale(0.88); }

.rx-send[data-visible="true"]:disabled { opacity: 0.4; }

.rx-hints { display: none; align-items: center; justify-content: center; gap: 18px; margin-top: 10px; font-size: 11.5px; color: var(--rx-label-3); }

@media (hover: hover) and (pointer: fine) { .rx-hints { display: flex; } }

.rx-hints span { display: inline-flex; align-items: center; gap: 5px; }

.rx-kbd {

  display: inline-grid; place-items: center; min-width: 20px; height: 18px; padding: 0 5px; border-radius: 5px;

  font: inherit; font-size: 11px; color: var(--rx-label-2); background: rgba(255, 255, 255, 0.07);

  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.06), 0 0 0 0.5px rgba(255, 255, 255, 0.12);

}



.rx-alert-scrim {

  position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 16px;

  background: rgba(0, 0, 0, 0.4);

  opacity: 0; visibility: hidden;

  transition: opacity 0.3s ease, visibility 0s linear 0.3s;

}

.rx-alert-scrim[data-open="true"] { opacity: 1; visibility: visible; transition-delay: 0s; }

.rx-alert {

  width: 100%; max-width: 280px; overflow: hidden; border-radius: 16px; text-align: center;

  background: rgba(46, 46, 48, 0.82);

  -webkit-backdrop-filter: blur(40px) saturate(180%);

  backdrop-filter: blur(40px) saturate(180%);

  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.14), 0 24px 60px rgba(0, 0, 0, 0.5);

  transform: scale(1.12); opacity: 0;

  transition: transform 0.45s var(--rx-ease), opacity 0.25s ease;

}

.rx-alert-scrim[data-open="true"] .rx-alert { transform: scale(1); opacity: 1; }

.rx-alert-body { padding: 22px 18px 20px; }

.rx-alert-body h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.022em; }

.rx-alert-body p { margin-top: 4px; font-size: 13px; line-height: 1.4; color: var(--rx-label-2); }

.rx-alert-actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 0.5px solid rgba(255, 255, 255, 0.14); }

.rx-alert-actions button { height: 46px; font-size: 17px; letter-spacing: -0.022em; transition: background-color 0.2s ease; }

.rx-alert-actions button + button { border-left: 0.5px solid rgba(255, 255, 255, 0.14); }

.rx-alert-actions button:hover { background: rgba(255, 255, 255, 0.05); }

.rx-alert-actions button:active { background: rgba(255, 255, 255, 0.12); }

.rx-alert-actions button[data-primary="true"] { font-weight: 600; color: #0a84ff; }

.rx-root .rx-alert-actions button:focus-visible { outline-offset: -3px; border-radius: 12px; }



@media (prefers-reduced-motion: reduce) {

  .rx-root *, .rx-root *::before, .rx-root *::after {

    animation-duration: 0.01ms !important;

    animation-delay: 0s !important;

    animation-iteration-count: 1 !important;

    transition-duration: 0.01ms !important;

    transition-delay: 0s !important;

  }

  .rx-root .rx-spinner i { animation-duration: 1s !important; animation-iteration-count: infinite !important; animation-delay: calc(var(--i) * 0.0833s - 1s) !important; }

  .rx-root .rx-typing i { animation-duration: 1.3s !important; animation-iteration-count: infinite !important; }

}

`;