import React, { useState } from "react";

const LandingPage = ({ onStart }) => {
  const [wipPage, setWipPage] = useState(null);
  const [closing, setClosing] = useState(false);

  const openWip = (page) => {
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

  // Work in progress page
  if (wipPage) {
    return (
      <div
        className={`min-h-screen bg-[#090909] text-white flex items-center justify-center relative overflow-hidden ${
          closing
            ? "animate-[wipOut_.35s_ease-in_forwards]"
            : "animate-[wipIn_.45s_ease-out]"
        }`}
      >
        {/* Subtle background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.035),transparent_45%)]" />

          <div className="absolute inset-0 opacity-[0.025] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:70px_70px]" />
        </div>

        {/* Content */}
        <main className="relative z-10 text-center px-5 sm:px-6">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-gray-600 mb-6 sm:mb-7">
            {wipPage}
          </p>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-[-0.045em] leading-none">
            Work in{" "}
            <span className="font-serif italic font-medium text-gray-400">
              progress.
            </span>
          </h1>

          <p className="mt-5 sm:mt-6 text-sm text-gray-500">
            We're still building this part of rigidX.
          </p>

          <button
            onClick={closeWip}
            className="
              mt-8
              sm:mt-9
              px-6
              py-3
              rounded-full
              bg-white
              text-black
              text-sm
              font-semibold
              hover:bg-gray-200
              hover:scale-105
              transition-all
            "
          >
            Go Back
          </button>
        </main>

        {/* Corner back button */}
        <button
          onClick={closeWip}
          className="
            absolute
            top-5
            left-5
            sm:top-7
            sm:left-7
            text-xs
            text-gray-500
            hover:text-white
            transition
          "
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Main background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_75%_at_50%_80%,rgba(55,18,130,0.95)_0%,rgba(38,10,95,0.85)_35%,rgba(15,3,35,0.7)_65%,rgba(0,0,0,1)_100%)]" />

      {/* Blue glow */}
      <div className="absolute bottom-[-20%] left-[-15%] w-[65%] h-[65%] rounded-full bg-[radial-gradient(ellipse,rgba(105,105,255,.95)_0%,rgba(82,76,225,.8)_35%,rgba(55,35,150,.35)_65%,transparent_78%)] blur-2xl" />

      {/* Purple glow */}
      <div className="absolute bottom-[-20%] right-[-15%] w-[65%] h-[65%] rounded-full bg-[radial-gradient(ellipse,rgba(170,35,255,.95)_0%,rgba(128,45,235,.8)_35%,rgba(75,25,155,.4)_65%,transparent_80%)] blur-2xl" />

      {/* Center glow */}
      <div className="absolute bottom-[-10%] left-[25%] w-[50%] h-[40%] rounded-full bg-[radial-gradient(ellipse,rgba(90,85,230,.65)_0%,rgba(70,45,170,.35)_50%,transparent_75%)] blur-3xl" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between w-full px-5 sm:px-8 md:px-14 py-5 sm:py-6">
        <div className="flex items-center min-w-0">
          <img
            src="/logo.png"
            alt="rigidX"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
          />

          {/* Desktop navigation */}
          <nav className="hidden sm:flex ml-10 md:ml-16 items-center gap-8 md:gap-14 text-[15px] font-semibold tracking-wide">
            {/* Chat */}
            <button
              onClick={onStart}
              className="hover:opacity-70 transition-opacity"
            >
              Chat
            </button>

            {/* Discover */}
            <button
              onClick={() => openWip("Discover")}
              className="hover:opacity-70 transition-opacity"
            >
              Discover
            </button>

            {/* About */}
            <button
              onClick={() => openWip("About")}
              className="hover:opacity-70 transition-opacity"
            >
              About
            </button>
          </nav>
        </div>

        <button
          onClick={onStart}
          className="
            bg-white
            text-black
            font-semibold
            text-xs
            sm:text-sm
            px-4
            sm:px-7
            py-2.5
            sm:py-3
            rounded-full
            shadow-md
            hover:bg-white/90
            hover:scale-105
            transition-all
            whitespace-nowrap
          "
        >
          Start Chatting
        </button>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex min-h-[calc(100vh-90px)] sm:min-h-[calc(100vh-112px)] flex-col items-center justify-center text-center px-5 -mt-6 sm:-mt-8">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
          rigidX
        </h1>

        <p className="text-lg sm:text-xl md:text-2xl font-semibold italic text-gray-300 tracking-wide mb-7 sm:mb-8 max-w-[320px] sm:max-w-none">
          Talk freely. Stay anonymous.
        </p>

        <button
          onClick={onStart}
          className="
            bg-white
            text-black
            font-semibold
            text-xs
            px-6
            sm:px-7
            py-3
            rounded-full
            shadow-lg
            hover:bg-white/90
            hover:scale-105
            transition-all
            duration-200
          "
        >
          Start Chatting
        </button>

        {/* Shortcut */}
        <div className="mt-5 sm:mt-6 text-xs text-gray-500 flex items-center gap-2">
          <kbd className="px-2 py-1 rounded-md bg-white/10 border border-white/10 text-gray-300">
            /
          </kbd>

          <span>to start chatting</span>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
