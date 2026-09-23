import React, { useState } from "react";

const LandingPage = ({ onStart }) => {
  const [wipPage, setWipPage] = useState(null);
  const [closing, setClosing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openWip = (page) => {
    setMobileNavOpen(false);
    setClosing(false);
    setWipPage(page);
  };

  const closeWip = () => {
    setClosing(true);
    setTimeout(() => {
      setWipPage(null);
      setClosing(false);
    }, 350);
  };

  if (wipPage) {
    return (
      <div
        className={`min-h-screen bg-[#090909] text-white flex items-center justify-center relative overflow-hidden p-4 ${
          closing
            ? "animate-[wipOut_.35s_ease-in_forwards]"
            : "animate-[wipIn_.45s_ease-out]"
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
            className="mt-6 sm:mt-9 px-6 py-2.5 sm:py-3 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-gray-200 hover:scale-105 transition-all"
          >
            Go Back
          </button>
        </main>

        <button
          onClick={closeWip}
          className="absolute top-5 left-5 text-xs text-gray-500 hover:text-white transition"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_75%_at_50%_80%,rgba(55,18,130,0.95)_0%,rgba(38,10,95,0.85)_35%,rgba(15,3,35,0.7)_65%,rgba(0,0,0,1)_100%)] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-15%] w-[80%] sm:w-[65%] h-[65%] rounded-full bg-[radial-gradient(ellipse,rgba(105,105,255,.95)_0%,rgba(82,76,225,.8)_35%,rgba(55,35,150,.35)_65%,transparent_78%)] blur-2xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[80%] sm:w-[65%] h-[65%] rounded-full bg-[radial-gradient(ellipse,rgba(170,35,255,.95)_0%,rgba(128,45,235,.8)_35%,rgba(75,25,155,.4)_65%,transparent_80%)] blur-2xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] sm:left-[25%] w-[80%] sm:w-[50%] h-[40%] rounded-full bg-[radial-gradient(ellipse,rgba(90,85,230,.65)_0%,rgba(70,45,170,.35)_50%,transparent_75%)] blur-3xl pointer-events-none" />

      <header className="relative z-20 flex items-center justify-between w-full px-5 sm:px-8 md:px-14 py-4 sm:py-6">
        <div className="flex items-center min-w-0">
          <img
            src="/logo.png"
            alt="rigidX"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
          />

          <nav className="hidden sm:flex ml-10 md:ml-16 items-center gap-8 md:gap-14 text-[15px] font-semibold tracking-wide">
            <button
              onClick={onStart}
              className="hover:opacity-70 transition-opacity"
            >
              Chat
            </button>
            <button
              onClick={() => openWip("Discover")}
              className="hover:opacity-70 transition-opacity"
            >
              Discover
            </button>
            <button
              onClick={() => openWip("About")}
              className="hover:opacity-70 transition-opacity"
            >
              About
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/amore147/rigidX"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full border border-white/15 backdrop-blur-md hover:scale-105 transition-all shadow-lg"
          >
            <svg
              className="w-4 h-4 fill-current text-white"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="text-amber-400 text-sm sm:text-base leading-none">
              ★
            </span>
            <span>Star</span>
          </a>

          <button
            onClick={onStart}
            className="bg-white text-black font-semibold text-xs sm:text-sm px-4 sm:px-7 py-2 sm:py-3 rounded-full shadow-md hover:bg-white/90 hover:scale-105 transition-all whitespace-nowrap"
          >
            Start Chatting
          </button>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="sm:hidden p-2 text-gray-300 hover:text-white"
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
        <div className="relative z-20 sm:hidden bg-black/90 border-b border-white/10 backdrop-blur-md px-6 py-4 flex flex-col gap-4 text-sm font-semibold">
          <button
            onClick={onStart}
            className="text-left py-1 hover:text-gray-300"
          >
            Chat
          </button>
          <button
            onClick={() => openWip("Discover")}
            className="text-left py-1 hover:text-gray-300"
          >
            Discover
          </button>
          <button
            onClick={() => openWip("About")}
            className="text-left py-1 hover:text-gray-300"
          >
            About
          </button>
        </div>
      )}

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 py-12">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-3 sm:mb-4">
          rigidX
        </h1>

        <p className="text-base sm:text-xl md:text-2xl font-semibold italic text-gray-300 tracking-wide mb-6 sm:mb-8 max-w-[280px] sm:max-w-none">
          Talk freely. Stay anonymous.
        </p>

        <button
          onClick={onStart}
          className="bg-white text-black font-semibold text-xs sm:text-sm px-6 sm:px-7 py-2.5 sm:py-3 rounded-full shadow-lg hover:bg-white/90 hover:scale-105 transition-all duration-200"
        >
          Start Chatting
        </button>

        <div className="mt-5 sm:mt-6 text-[11px] sm:text-xs text-gray-500 flex items-center gap-2">
          <kbd className="px-2 py-0.5 sm:py-1 rounded-md bg-white/10 border border-white/10 text-gray-300">
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
