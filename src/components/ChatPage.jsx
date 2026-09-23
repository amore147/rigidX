import React, { useEffect, useRef, useState } from "react";
import { themes } from "../service/theme";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ChatPage = ({ onLeave }) => {
  // =============================
  // Theme
  // =============================

  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem("rigidx-theme") || "cosmic";
  });

  const theme = themes[themeName];

  useEffect(() => {
    localStorage.setItem("rigidx-theme", themeName);
  }, [themeName]);

  // =============================
  // Chat state
  // =============================

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

  const inputRef = useRef(null);

  // =============================
  // Focus input
  // =============================

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  // =============================
  // Keyboard shortcuts
  // =============================

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
        onLeave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onLeave]);

  // =============================
  // Send message
  // =============================

  const sendMessage = async () => {
    if (!input.trim() || loading || finding) {
      return;
    }

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

      // Small natural delay
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
        inputRef.current?.focus();
      }, 50);
    }
  };

  // =============================
  // Skip stranger
  // =============================

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
      inputRef.current?.focus();
    }, 100);
  };

  // =============================
  // UI
  // =============================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 pointer-events-none">
      <div
        className="
            pointer-events-auto
            relative
            w-full
            max-w-[1150px]
            h-screen
            sm:h-[84vh]
            min-h-0
            sm:min-h-[600px]
            rounded-none
            sm:rounded-[20px]
            overflow-hidden
            border
            flex
            shadow-[0_30px_100px_rgba(0,0,0,0.45)] 
            animate-[chatWindow_.35s_ease-out]
            "
        style={{
          background: theme.background,
          borderColor: theme.border,
        }}
      >
        {/* Ambient glow */}

        <div
          className="
            absolute
            top-[-150px]
            right-[-100px]
            w-[500px]
            h-[400px]
            rounded-full
            blur-[130px]
            pointer-events-none
          "
          style={{
            background: theme.glow,
          }}
        />

        {/* ============================= */}
        {/* Sidebar */}
        {/* ============================= */}

        <aside
          className="
            relative
            z-10
            hidden
            sm:flex
            w-[220px]
            shrink-0
            h-full
            border-r
            flex-col
            " 
          style={{
            background: theme.sidebar,
            borderColor: theme.border,
          }}
        >
          <div className="px-4 pt-5">
            <button
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                rounded-xl
                text-sm
              "
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

          {/* Appearance */}

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

                <span
                  className="text-[10px]"
                  style={{
                    color: theme.muted,
                  }}
                >
                  {theme.name}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Object.entries(themes).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setThemeName(key)}
                    title={value.name}
                    className={`
                        w-7
                        h-7
                        rounded-full
                        transition-all
                        ${
                          themeName === key
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#18181c]"
                            : "hover:scale-110"
                        }
                      `}
                    style={{
                      background: value.accent,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Profile */}

          <div
            className="border-t px-5 py-4"
            style={{
              borderColor: theme.border,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  w-9
                  h-9
                  rounded-full
                  flex
                  items-center
                  justify-center
                  text-sm
                  font-semibold
                "
                style={{
                  background:
                    themeName === "mono" ? "#2a2a2a" : `${theme.accent}30`,
                  color: themeName === "mono" ? "#ffffff" : theme.accentHover,
                }}
              >
                U
              </div>

              <div>
                <p
                  className="text-sm"
                  style={{
                    color: theme.text,
                  }}
                >
                  Anonymous
                </p>

                <p
                  className="text-xs"
                  style={{
                    color: theme.muted,
                  }}
                >
                  rigidX user
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ============================= */}
        {/* Main chat */}
        {/* ============================= */}

        <main
          className="
            relative
            z-10
            flex-1
            flex
            flex-col
            min-w-0
          "
        >
          {/* Header */}

          <header
            className="
              h-[68px]
              shrink-0
              border-b
              flex
              items-center
              justify-between
              px-7
            "
            style={{
              borderColor: theme.border,
            }}
          >
            <div>
              <h1
                className="text-base font-semibold"
                style={{
                  color: theme.text,
                }}
              >
                Stranger
              </h1>

              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />

                <span
                  style={{
                    color: theme.muted,
                  }}
                >
                  Connected
                </span>
              </div>
            </div>

            <button
              onClick={onLeave}
              className="
                text-sm
                px-3
                py-2
                rounded-lg
                hover:bg-white/5
                transition
              "
              style={{
                color: theme.muted,
              }}
            >
              Leave
            </button>
          </header>

          {/* Finding stranger */}

          {finding ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-7">
                  <div
                    className="
                      absolute
                      inset-0
                      rounded-full
                      border
                    "
                    style={{
                      borderColor: `${theme.accent}30`,
                    }}
                  />

                  <div
                    className="
                      absolute
                      inset-0
                      rounded-full
                      border-2
                      border-transparent
                      animate-spin
                    "
                    style={{
                      borderTopColor: theme.accent,
                    }}
                  />

                  <div
                    className="
                      absolute
                      inset-3
                      rounded-full
                      border-2
                      border-transparent
                      animate-spin
                    "
                    style={{
                      borderTopColor: theme.accentHover,
                      animationDuration: "1.5s",
                      animationDirection: "reverse",
                    }}
                  />

                  <div
                    className="
                      absolute
                      inset-7
                      rounded-full
                      animate-pulse
                    "
                    style={{
                      background: theme.accent,
                    }}
                  />
                </div>

                <h2
                  className="text-xl font-semibold"
                  style={{
                    color: theme.text,
                  }}
                >
                  Finding someone...
                </h2>

                <p
                  className="text-sm mt-2"
                  style={{
                    color: theme.muted,
                  }}
                >
                  Looking for a new stranger
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}

              <div
                className="
                  flex-1
                  overflow-y-auto
                  px-7
                  py-8
                "
              >
                <div className="max-w-3xl mx-auto">
                  {messages.length === 1 && (
                    <div className="text-center mb-12">
                      <div
                        className="
                          w-20
                          h-20
                          rounded-full
                          mx-auto
                          mb-6
                          flex
                          items-center
                          justify-center
                          text-3xl
                        "
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
                        className="text-2xl font-semibold"
                        style={{
                          color: theme.text,
                        }}
                      >
                        You are now connected
                      </h2>

                      <p
                        className="text-sm mt-2"
                        style={{
                          color: theme.muted,
                        }}
                      >
                        Say hello to your anonymous stranger.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`
                          flex
                          ${
                            msg.sender === "you"
                              ? "justify-end"
                              : "justify-start"
                          }
                        `}
                      >
                        <div
                          className="
                            max-w-[70%]
                            px-4
                            py-3
                            rounded-2xl
                            text-sm
                          "
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
                          className="
                            px-4
                            py-3
                            rounded-2xl
                          "
                          style={{
                            background: theme.bubble,
                          }}
                        >
                          <div
                            className="flex gap-1"
                            style={{
                              color: theme.muted,
                            }}
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
                  </div>
                </div>
              </div>

              {/* Input */}

              <div className="px-7 pb-6">
                <div className="max-w-3xl mx-auto">
                  <div
                    className="
                      rounded-2xl
                      border
                      p-3
                      shadow-lg
                    "
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
                        if (e.key !== "Enter") {
                          return;
                        }

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
                      className="
                        w-full
                        bg-transparent
                        outline-none
                        px-2
                        py-2
                        text-sm
                        placeholder:text-gray-500
                      "
                      style={{
                        color: theme.text,
                      }}
                    />

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          className="
                            text-xs
                            px-3
                            py-2
                            rounded-lg
                            transition
                            hover:bg-white/5
                          "
                          style={{
                            color: theme.muted,
                          }}
                        >
                          ＋
                        </button>

                        <span
                          className="text-xs"
                          style={{
                            color: theme.muted,
                          }}
                        >
                          Anonymous chat
                        </span>
                      </div>

                      <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="
                          w-9
                          h-9
                          rounded-lg
                          flex
                          items-center
                          justify-center
                          text-sm
                          transition
                          disabled:opacity-30
                        "
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
                    className="
                      text-center
                      text-[10px]
                      mt-3
                    "
                    style={{
                      color: theme.muted,
                    }}
                  >
                    <span
                      style={{
                        color: theme.text,
                      }}
                    >
                      /
                    </span>{" "}
                    focus • Enter send • Enter twice skip • Esc leave
                  </p>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Skip confirmation */}

        {skipConfirm && (
          <div
            className="
              absolute
              inset-0
              z-50
              bg-black/45
              backdrop-blur-sm
              flex
              items-center
              justify-center
            "
          >
            <div
              className="
                w-[340px]
                rounded-2xl
                border
                p-6
                shadow-2xl
              "
              style={{
                background: theme.panel,
                borderColor: theme.border,
              }}
            >
              <h2
                className="text-lg font-semibold"
                style={{
                  color: theme.text,
                }}
              >
                Skip this stranger?
              </h2>

              <p
                className="text-sm mt-2 mb-6"
                style={{
                  color: theme.muted,
                }}
              >
                You'll be connected to someone new.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSkipConfirm(false)}
                  className="
                    px-4
                    py-2
                    text-sm
                    rounded-lg
                    hover:bg-white/5
                  "
                  style={{
                    color: theme.muted,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={skipStranger}
                  className="
                    px-4
                    py-2
                    text-sm
                    rounded-lg
                  "
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
