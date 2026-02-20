import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/App.css";

const ProfessorPage = () => {
  const navigate = useNavigate();

  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className={`min-h-screen flex flex-col font-[Inter,system-ui,sans-serif] transition-colors duration-300 ${dark ? "bg-slate-950 text-white" : "bg-gray-50 text-gray-900"}`}>

      {/* Top bar */}
      <header className={`h-14 flex items-center justify-between px-6 border-b shrink-0 transition-colors duration-300 ${dark ? "border-white/5 bg-slate-950/60 backdrop-blur-sm" : "border-gray-200 bg-white/80 backdrop-blur-sm"}`}>
        <button
          onClick={() => navigate("/")}
          className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${dark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
            Professor Dashboard
          </span>
          <button
            onClick={() => setDark((v) => !v)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${dark ? "border-white/10 text-slate-400 hover:text-white" : "border-gray-200 text-gray-500 hover:text-gray-900"}`}
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Centered placeholder */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl text-white mb-5 shadow-xl shadow-violet-500/20">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h2 className={`text-2xl font-semibold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
          Coming Soon
        </h2>
        <p className={`text-sm max-w-sm text-center mb-8 ${dark ? "text-slate-500" : "text-gray-500"}`}>
          The professor dashboard is under construction. You'll be able to manage courses, upload materials, and configure your AI agent here.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2.5 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-white text-sm font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
        >
          Return Home
        </button>
      </main>
    </div>
  );
};

export default ProfessorPage;
