import React, { useEffect, useRef, useState } from "react";
import { themes } from "../service/theme";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ChatPage = ({ onLeave }) => {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem("rigidx-theme") || "cosmic";
  });

  const theme = themes[themeName];

  useEffect(() => {
    localStorage.setItem("rigidx-theme", themeName);
  }, [themeName]);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "stranger",
      text: "Hey 👋",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [finding, setFinding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.innerWidth >= 640) {
        inputRef.current?.focus();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        setSkipConfirm(false);
        setMobileMenuOpen(false);
        onLeave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onLeave]);

  const sendMessage = async () => {
    if (!input.trim() || loading || finding) return;

    const userMessage = input.trim();
    setInput("");

    const newUserMessage = {
      id: Date.now(),
      sender: "you",
      text: userMessage,
    };

    const history = messages.map((msg) => ({
      role: msg.sender === "you" ? "user" : "assistant",
      content: msg.text,
    }));

    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.reply) {
        throw new Error("Invalid API response");
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 300 + Math.random() * 400),
      );

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "stranger",
          text: data.reply,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "stranger",
          text: "bruh my brain lagged 😭",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (window.innerWidth >= 640) {
          inputRef.current?.focus();
        }
      }, 50);
    }
  };

  const skipStranger = async () => {
    setSkipConfirm(false);
    setLoading(false);
    setInput("");
    setFinding(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setMessages([
      {
        id: Date.now(),
        sender: "stranger",
        text: "Hey 👋",
      },
    ]);

    setFinding(false);

    setTimeout(() => {
      if (window.innerWidth >= 640) {
        inputRef.current?.focus();
      }
    }, 100);
  };

  const SidebarContent = () => (
    <>
      <div className="px-4 pt-5">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: `${theme.accent}18`,
            color: theme.accentHover,
          }}
        >
          <span>💬</span>
          Chat
        </button>
      </div>

      <div className="flex-1" />

      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 px-2 mb-3">Appearance</p>
        <div
          className="rounded-xl p-3 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: theme.border,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">Theme</p>
            <span className="text-[10px]" style={{ color: theme.muted }}>
              {theme.name}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {Object.entries(themes).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setThemeName(key)}
                title={value.name}
                className={`w-7 h-7 rounded-full transition-all ${
                  themeName === key
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#18181c]"
                    : "hover:scale-110"
                }`}
                style={{ background: value.accent }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t px-5 py-4" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{
              background:
                themeName === "mono" ? "#2a2a2a" : `${theme.accent}30`,
              color: themeName === "mono" ? "#ffffff" : theme.accentHover,
            }}
          >
            U
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: theme.text }}
            >
              Anonymous
            </p>
            <p className="text-xs truncate" style={{ color: theme.muted }}>
              rigidX user
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 pointer-events-none">
      <div
        className="pointer-events-auto relative w-full max-w-[1150px] h-[100dvh] sm:h-[85vh] sm:min-h-[600px] rounded-none sm:rounded-[20px] overflow-hidden border-0 sm:border flex shadow-[0_30px_100px_rgba(0,0,0,0.45)] animate-[chatWindow_.35s_ease-out]"
        style={{
          background: theme.background,
          borderColor: theme.border,
        }}
      >
        <div
          className="absolute top-[-150px] right-[-100px] w-[300px] sm:w-[500px] h-[300px] sm:h-[400px] rounded-full blur-[100px] sm:blur-[130px] pointer-events-none"
          style={{ background: theme.glow }}
        />

        <aside
          className="relative z-10 hidden sm:flex w-[220px] shrink-0 h-full border-r flex-col"
          style={{
            background: theme.sidebar,
            borderColor: theme.border,
          }}
        >
          <SidebarContent />
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r transition-transform duration-300 ease-in-out sm:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            background: theme.sidebar || theme.background,
            borderColor: theme.border,
          }}
        >
          <div
            className="p-4 flex items-center justify-between border-b"
            style={{ borderColor: theme.border }}
          >
            <span
              className="font-semibold text-sm"
              style={{ color: theme.text }}
            >
              Settings
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <SidebarContent />
        </div>

        <main className="relative z-10 flex-1 flex flex-col min-w-0 h-full">
          <header
            className="h-[60px] sm:h-[68px] shrink-0 border-b flex items-center justify-between px-4 sm:px-7"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="sm:hidden p-2 -ml-2 rounded-lg text-gray-400 hover:bg-white/5"
                aria-label="Open menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div>
                <h1
                  className="text-sm sm:text-base font-semibold"
                  style={{ color: theme.text }}
                >
                  Stranger
                </h1>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span style={{ color: theme.muted }}>Connected</span>
                </div>
              </div>
            </div>

            <button
              onClick={onLeave}
              className="text-xs sm:text-sm px-3 py-1.5 sm:py-2 rounded-lg hover:bg-white/5 transition"
              style={{ color: theme.muted }}
            >
              Leave
            </button>
          </header>

          {finding ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 sm:mb-7">
                  <div
                    className="absolute inset-0 rounded-full border"
                    style={{ borderColor: `${theme.accent}30` }}
                  />
                  <div
                    className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                    style={{ borderTopColor: theme.accent }}
                  />
                  <div
                    className="absolute inset-3 rounded-full border-2 border-transparent animate-spin"
                    style={{
                      borderTopColor: theme.accentHover,
                      animationDuration: "1.5s",
                      animationDirection: "reverse",
                    }}
                  />
                  <div
                    className="absolute inset-6 sm:inset-7 rounded-full animate-pulse"
                    style={{ background: theme.accent }}
                  />
                </div>

                <h2
                  className="text-lg sm:text-xl font-semibold"
                  style={{ color: theme.text }}
                >
                  Finding someone...
                </h2>
                <p
                  className="text-xs sm:text-sm mt-1 sm:mt-2"
                  style={{ color: theme.muted }}
                >
                  Looking for a new stranger
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-8">
                <div className="max-w-3xl mx-auto">
                  {messages.length === 1 && (
                    <div className="text-center mb-8 sm:mb-12 pt-4">
                      <div
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center text-2xl sm:text-3xl"
                        style={{
                          background:
                            themeName === "mono"
                              ? "#1f1f1f"
                              : `${theme.accent}15`,
                          boxShadow:
                            themeName === "mono"
                              ? "0 0 50px rgba(255,255,255,0.025)"
                              : `0 0 70px ${theme.glow}`,
                        }}
                      >
                        👋
                      </div>
                      <h2
                        className="text-xl sm:text-2xl font-semibold"
                        style={{ color: theme.text }}
                      >
                        You are now connected
                      </h2>
                      <p
                        className="text-xs sm:text-sm mt-1.5 sm:mt-2"
                        style={{ color: theme.muted }}
                      >
                        Say hello to your anonymous stranger.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 sm:space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender === "you" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className="max-w-[85%] sm:max-w-[70%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm leading-relaxed break-words"
                          style={{
                            background:
                              msg.sender === "you"
                                ? theme.accent
                                : theme.bubble,
                            color:
                              msg.sender === "you" && themeName === "mono"
                                ? "#111111"
                                : theme.text,
                          }}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}

                    {loading && (
                      <div className="flex justify-start">
                        <div
                          className="px-4 py-3 rounded-2xl"
                          style={{ background: theme.bubble }}
                        >
                          <div
                            className="flex gap-1"
                            style={{ color: theme.muted }}
                          >
                            <span className="animate-bounce">•</span>
                            <span className="animate-bounce [animation-delay:150ms]">
                              •
                            </span>
                            <span className="animate-bounce [animation-delay:300ms]">
                              •
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-7 pb-4 sm:pb-6 pt-2 shrink-0">
                <div className="max-w-3xl mx-auto">
                  <div
                    className="rounded-2xl border p-2.5 sm:p-3 shadow-lg"
                    style={{
                      background: theme.input,
                      borderColor: theme.border,
                    }}
                  >
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;

                        if (!input.trim()) {
                          const now = Date.now();
                          const lastEnter =
                            e.currentTarget.dataset.lastEnter || 0;

                          if (now - Number(lastEnter) < 500) {
                            e.preventDefault();
                            e.currentTarget.dataset.lastEnter = 0;
                            setSkipConfirm(true);
                            return;
                          }

                          e.currentTarget.dataset.lastEnter = now;
                          return;
                        }

                        sendMessage();
                      }}
                      disabled={loading}
                      placeholder="Ask anything..."
                      className="w-full bg-transparent outline-none px-2 py-1 sm:py-2 text-xs sm:text-sm placeholder:text-gray-500"
                      style={{ color: theme.text }}
                    />

                    <div className="flex items-center justify-between mt-1 sm:mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition hover:bg-white/5"
                          style={{ color: theme.muted }}
                        >
                          ＋
                        </button>
                        <span
                          className="text-[11px] sm:text-xs"
                          style={{ color: theme.muted }}
                        >
                          Anonymous chat
                        </span>
                      </div>

                      <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs sm:text-sm transition disabled:opacity-30 shrink-0"
                        style={{
                          background: theme.accent,
                          color: themeName === "mono" ? "#111111" : "#ffffff",
                        }}
                      >
                        ↑
                      </button>
                    </div>
                  </div>

                  <p
                    className="text-center text-[10px] sm:text-[11px] mt-2 sm:mt-3"
                    style={{ color: theme.muted }}
                  >
                    <span className="hidden sm:inline">
                      <span style={{ color: theme.text }}>/</span> focus • Enter
                      send • Enter twice skip • Esc leave
                    </span>
                    <span className="sm:hidden">
                      Tap enter to send • Double enter to skip
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}
        </main>

        {skipConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="w-full max-w-[340px] rounded-2xl border p-5 sm:p-6 shadow-2xl"
              style={{
                background: theme.panel,
                borderColor: theme.border,
              }}
            >
              <h2
                className="text-base sm:text-lg font-semibold"
                style={{ color: theme.text }}
              >
                Skip this stranger?
              </h2>

              <p
                className="text-xs sm:text-sm mt-1.5 sm:mt-2 mb-5 sm:mb-6"
                style={{ color: theme.muted }}
              >
                You'll be connected to someone new.
              </p>

              <div className="flex justify-end gap-2.5 sm:gap-3">
                <button
                  onClick={() => setSkipConfirm(false)}
                  className="px-3.5 py-2 text-xs sm:text-sm rounded-lg hover:bg-white/5"
                  style={{ color: theme.muted }}
                >
                  Cancel
                </button>

                <button
                  onClick={skipStranger}
                  className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg"
                  style={{
                    background: theme.accent,
                    color: themeName === "mono" ? "#111111" : "#ffffff",
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
