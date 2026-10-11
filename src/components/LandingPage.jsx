import React, { useState, useEffect } from "react";
import ColorBends from "./ColorBends";
import ShinyText from "./ShinyText";

const LandingPage = ({ onStart, onStartGlobal }) => {
  const [wipPage, setWipPage] = useState(null);
  const [closing, setClosing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        ["INPUT", "TEXTAREA"].indexOf(document.activeElement.tagName) === -1
      ) {
        e.preventDefault();
        onStart();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStart]);

  const openWip = (page) => {
    setMobileNavOpen(false);
    setClosing(false);
    setWipPage(page);
  };

  const closeWip = () => {
    setClosing(true);

    const timer = setTimeout(() => {
      setWipPage(null);
      setClosing(false);
    }, 350);

    return () => clearTimeout(timer);
  };

  if (wipPage) {
    return (
      <div
        className={`min-h-screen bg-[#090909] text-white flex items-center justify-center relative overflow-hidden p-4 ${
          closing
            ? "animate-[wipOut_0.35s_ease-in_forwards]"
            : "animate-[wipIn_0.45s_ease-out]"
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.035),transparent_45%)]" />

          <div className="absolute inset-0 opacity-[0.025] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:70px_70px]" />
        </div>

        <main className="relative z-10 text-center px-4 max-w-lg mx-auto">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-gray-600 mb-4 sm:mb-7">
            {wipPage}
          </p>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-[-0.045em] leading-tight sm:leading-none">
            Work in{" "}
            <span className="font-serif italic font-medium text-gray-400">
              progress.
            </span>
          </h1>

          <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500">
            We're still building this part of rigidX.
          </p>

          <button
            onClick={closeWip}
            className="mt-6 sm:mt-9 px-6 py-2.5 sm:py-3 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-gray-200 hover:scale-105 transition-all cursor-pointer"
          >
            Go Back
          </button>
        </main>

        <button
          onClick={closeWip}
          className="absolute top-5 left-5 text-xs text-gray-500 hover:text-white transition cursor-pointer"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white relative isolate overflow-hidden flex flex-col justify-between">
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <ColorBends
          colors={["#27272A", "#71717A", "#D4D4D8"]}
          rotation={90}
          speed={0.2}
          scale={1.6}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          noise={0.15}
          parallax={0.5}
          iterations={2}
          intensity={1.5}
          bandWidth={6}
          transparent
          className="h-full w-full"
        />
      </div>

      <header className="relative z-20 flex items-center justify-between w-full px-4 sm:px-8 md:px-14 py-4 sm:py-6 gap-2">
        <div className="flex items-center min-w-0">
          <img
            src="/logo.png"
            alt="rigidX logo"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0 mix-blend-screen"
          />

          <nav className="hidden sm:flex ml-6 md:ml-12 items-center gap-6 md:gap-10 text-[14px] md:text-[15px] font-semibold tracking-wide bg-black/20 backdrop-blur-md border border-white/10 rounded-full px-4 md:px-5 py-2 text-[#D4D4D8]">
            <button
              onClick={onStart}
              className="text-[#D4D4D8] hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Chat
            </button>

            <button
              onClick={() => openWip("Discover")}
              className="text-[#D4D4D8] hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Discover
            </button>

            <button
              onClick={() => openWip("About")}
              className="text-[#D4D4D8] hover:text-white transition-colors duration-200 cursor-pointer"
            >
              About
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="https://github.com/amore147/rigidX"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 bg-black/20 hover:bg-black/30 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-full border border-white/15 backdrop-blur-md hover:scale-105 transition-all shadow-lg cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-white shrink-0"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>

            <span className="text-amber-400 text-xs sm:text-base leading-none">
              ★
            </span>

            <span>Star</span>
          </a>

          <button
            onClick={onStart}
            className="bg-white text-black font-semibold text-xs sm:text-sm px-4 sm:px-7 py-2 sm:py-3 rounded-full shadow-md hover:bg-white/90 hover:scale-105 transition-all whitespace-nowrap cursor-pointer"
          >
            Start Chatting
          </button>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="sm:hidden p-1.5 text-gray-300 hover:text-white cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileNavOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="relative z-20 sm:hidden bg-black/95 border-b border-white/10 backdrop-blur-md px-6 py-5 flex flex-col gap-4 text-sm font-semibold animate-[iosPopIn_0.2s_ease-out]">
          <button
            onClick={() => {
              setMobileNavOpen(false);
              onStart();
            }}
            className="text-left py-1.5 text-[#D4D4D8] hover:text-white cursor-pointer"
          >
            Chat
          </button>

          <button
            onClick={() => openWip("Discover")}
            className="text-left py-1.5 text-[#D4D4D8] hover:text-white cursor-pointer"
          >
            Discover
          </button>

          <button
            onClick={() => openWip("About")}
            className="text-left py-1.5 text-[#D4D4D8] hover:text-white cursor-pointer"
          >
            About
          </button>
        </div>
      )}

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 py-12">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-3 sm:mb-4">
          <ShinyText
            text="rigidX"
            color="#D4D4D8"
            shineColor="#FFFFFF"
            speed={2}
            shineWidth={35}
            softness={0.8}
            glow={0.15}
            trigger="loop"
          />
        </h1>

        <p className="text-sm sm:text-xl md:text-2xl font-semibold italic text-gray-300 tracking-wide mb-6 sm:mb-8 max-w-[280px] sm:max-w-none">
          Talk freely. Stay anonymous.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onStart}
            className="bg-white text-black font-semibold text-xs sm:text-sm px-6 sm:px-7 py-2.5 sm:py-3 rounded-full shadow-lg hover:bg-white/90 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            Start Chatting
          </button>

          <button
            onClick={onStartGlobal}
            className="bg-black/30 text-white font-semibold text-xs sm:text-sm px-6 sm:px-7 py-2.5 sm:py-3 rounded-full border border-white/20 backdrop-blur-md hover:bg-white/10 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            Enter Global Chat
          </button>
        </div>

        <div className="mt-5 sm:mt-6 text-[11px] sm:text-xs text-gray-500 flex items-center gap-2">
          <kbd className="px-2 py-0.5 sm:py-1 rounded-md bg-white/10 border border-white/10 text-gray-300 font-mono">
            /
          </kbd>

          <span>to start chatting</span>
        </div>
      </main>

      <div className="h-4 sm:h-8" />
    </div>
  );
};

export default LandingPage;
