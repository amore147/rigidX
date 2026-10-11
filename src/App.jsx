import React, { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import ChatPage from "./components/ChatPage";
import GlobalChat from "./components/GlobalChat";

const App = () => {
  const [view, setView] = useState(null);
  const chatOpen = view !== null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const el = e.target;
      const isTyping =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable;

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if (view !== null) return;

      if (e.key === "/") {
        e.preventDefault();
        setView("ai");
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setView("global");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className={`absolute inset-0 transition-all duration-500 ease-out ${
          chatOpen
            ? "scale-[0.985] blur-[2px] opacity-55"
            : "scale-100 blur-0 opacity-100"
        }`}
      >
        <LandingPage
          onStart={() => setView("ai")}
          onStartGlobal={() => setView("global")}
        />
      </div>

      {view === "ai" && (
        <ChatPage
          onLeave={() => setView(null)}
          onSwitchToGlobal={() => setView("global")}
        />
      )}

      {view === "global" && (
        <GlobalChat
          onBack={() => setView(null)}
          onSwitchToAI={() => setView("ai")}
        />
      )}
    </div>
  );
};

export default App;
