import React, { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import ChatPage from "./components/ChatPage";

const App = () => {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

      // "/" → open chat
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        setChatOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ================================= */}
      {/* Landing background */}
      {/* ================================= */}

      <div
        className={`absolute inset-0 transition-all duration-500 ease-out ${
          chatOpen
            ? "scale-[0.985] blur-[2px] opacity-55"
            : "scale-100 blur-0 opacity-100"
        }`}
      >
        <LandingPage onStart={() => setChatOpen(true)} />
      </div>

      {/* ================================= */}
      {/* Floating chat */}
      {/* ================================= */}

      {chatOpen && <ChatPage onLeave={() => setChatOpen(false)} />}
    </div>
  );
};

export default App;
