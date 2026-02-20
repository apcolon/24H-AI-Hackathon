import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/App.css";

const HomePage = () => {
  const navigate = useNavigate();

  // Theme: init from localStorage, fallback to OS preference
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

      {/* Theme toggle (top-right) */}
      <div className="absolute top-5 right-6 z-10">
        <button
          onClick={() => setDark((v) => !v)}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${dark ? "border-white/10 text-slate-400 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"}`}
          aria-label="Toggle theme"
        >
          {dark ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Main content — vertically centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">

        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-4xl font-bold text-white mb-6 shadow-2xl shadow-indigo-500/30">
          M
        </div>

        {/* Title */}
        <h1 className={`text-4xl sm:text-5xl font-bold tracking-tight mb-3 ${dark ? "text-white" : "text-gray-900"}`}>
          Motus
        </h1>
        <p className={`text-lg mb-14 max-w-md text-center ${dark ? "text-slate-400" : "text-gray-500"}`}>
          Your AI-powered classroom assistant. Select your role to get started.
        </p>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Student card */}
          <button
            onClick={() => navigate("/chat")}
            className={`group relative rounded-2xl p-8 border text-left transition-all duration-200 cursor-pointer ${
              dark
                ? "bg-white/4 border-white/10 hover:border-indigo-500/40 hover:bg-white/7"
                : "bg-white border-gray-200 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10"
            }`}
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
              </svg>
            </div>

            <h2 className={`text-xl font-semibold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
              Student
            </h2>
            <p className={`text-sm leading-relaxed ${dark ? "text-slate-400" : "text-gray-500"}`}>
              Chat with an AI tutor about your course material, review lecture content, and get help with concepts.
            </p>

            {/* Arrow */}
            <div className={`absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity ${dark ? "text-indigo-400" : "text-indigo-500"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>

          {/* Professor card */}
          <button
            onClick={() => navigate("/professor")}
            className={`group relative rounded-2xl p-8 border text-left transition-all duration-200 cursor-pointer ${
              dark
                ? "bg-white/4 border-white/10 hover:border-violet-500/40 hover:bg-white/7"
                : "bg-white border-gray-200 hover:border-violet-400 hover:shadow-lg hover:shadow-violet-500/10"
            }`}
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25 group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>

            <h2 className={`text-xl font-semibold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
              Professor
            </h2>
            <p className={`text-sm leading-relaxed ${dark ? "text-slate-400" : "text-gray-500"}`}>
              Manage your courses, upload lecture materials, and configure your AI tutoring agent.
            </p>

            {/* Arrow */}
            <div className={`absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity ${dark ? "text-violet-400" : "text-violet-500"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-6 text-center text-xs ${dark ? "text-slate-600" : "text-gray-400"}`}>
        Motus &mdash; 24H AI Hackathon
      </footer>
    </div>
  );
};

export default HomePage;
