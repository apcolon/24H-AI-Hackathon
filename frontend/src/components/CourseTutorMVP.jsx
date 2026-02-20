import React, { useState, useEffect, useRef } from "react";
import "../styles/App.css";

/**
 * Render markdown-style links [text](url) as clickable <a> tags.
 */
function renderMessageText(text, dark) {
  const parts = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match;
  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline transition-colors ${dark ? "text-indigo-300 hover:text-indigo-100" : "text-indigo-600 hover:text-indigo-800"}`}
      >
        {match[1]}
      </a>,
    );
    last = linkRe.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Format time for message timestamps */
function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const CourseTutorMVP = () => {
  const [classes, setClasses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef(null);

  // Theme: init from localStorage, fallback to OS preference
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // 1. Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      const response = await fetch("/api/get_classes", {
        credentials: "include",
      });
      const data = await response.json();
      setClasses(data.classes);
      if (data.classes.length > 0) setSelectedCourse(data.classes[0]);
    };
    fetchClasses();
  }, []);

  // 2. Fetch chat history when course changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedCourse) return;
      const response = await fetch(
        `/api/chat_history?course=${encodeURIComponent(selectedCourse)}`,
        { credentials: "include" },
      );
      const data = await response.json();
      setChatHistory(data.results);
    };
    fetchHistory();
  }, [selectedCourse]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  // 3. Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      time: new Date().toISOString(),
      sender: "user",
      text: inputMessage,
    };
    setChatHistory((prev) => [...prev, newMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/send_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          course: selectedCourse,
          prompt: newMessage.text,
        }),
      });
      const data = await response.json();
      const agentResponse = {
        time: new Date().toISOString(),
        sender: "agent",
        text: data.reply,
      };
      setChatHistory((prev) => [...prev, agentResponse]);
      speak(agentResponse.text);
    } catch (error) {
      console.error("Failed to send message:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          time: new Date().toISOString(),
          sender: "agent",
          text: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = async (text) => {
    if (!ttsEnabled || !text?.trim()) return;
    try {
      setIsSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.onended = () => setIsSpeaking(false);
      await audioRef.current.play();
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  return (
    <div className={`flex h-screen font-[Inter,system-ui,sans-serif] transition-colors duration-300 ${dark ? "bg-slate-950 text-white" : "bg-gray-50 text-gray-900"}`}>

      {/* ───── Sidebar ───── */}
      <aside className={`w-72 flex flex-col border-r transition-colors duration-300 ${dark ? "border-white/10 bg-linear-to-b from-slate-900 to-slate-950" : "border-gray-200 bg-white"}`}>
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
            M
          </div>
          <span className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>Motus</span>
        </div>

        {/* New Chat button */}
        <div className="px-4 mb-2">
          <button
            onClick={() => {
              setChatHistory([]);
            }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${dark ? "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Divider */}
        <div className={`mx-4 border-t my-2 ${dark ? "border-white/5" : "border-gray-100"}`} />

        {/* Class list */}
        <div className="px-4 flex-1 overflow-y-auto">
          <h2 className={`text-[11px] font-semibold uppercase tracking-widest mb-3 px-1 ${dark ? "text-slate-500" : "text-gray-400"}`}>
            Your Classes
          </h2>
          <nav className="space-y-1">
            {classes.map((courseName) => (
              <button
                key={courseName}
                onClick={() => setSelectedCourse(courseName)}
                className={`sidebar-item w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${dark ? "" : "light"} ${
                  selectedCourse === courseName
                    ? `active ${dark ? "text-white" : "text-indigo-700"}`
                    : dark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  {courseName}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar footer controls */}
        <div className={`px-4 py-4 border-t space-y-2 ${dark ? "border-white/5" : "border-gray-100"}`}>
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${dark ? "text-slate-400 hover:text-white border border-white/5 hover:border-white/10" : "text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300"}`}
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
            {dark ? "Light Mode" : "Dark Mode"}
          </button>

          {/* Voice toggle */}
          <button
            type="button"
            onClick={() => setTtsEnabled((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              ttsEnabled
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : dark
                  ? "text-slate-500 hover:text-slate-300 border border-white/5 hover:border-white/10"
                  : "text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {ttsEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              )}
            </svg>
            Voice {ttsEnabled ? "On" : "Off"}
            {isSpeaking && (
              <span className="ml-auto flex gap-0.5">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </span>
            )}
          </button>

          {/* Generate Podcast button */}
          <button
            type="button"
            onClick={() => {
              // TODO: Implement podcast generation
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border border-amber-400/30 shadow-lg shadow-amber-500/20`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Generate Short Podcast!
          </button>
        </div>
      </aside>

      {/* ───── Main Panel ───── */}
      <main className={`flex-1 flex flex-col min-w-0 transition-colors duration-300 ${dark ? "bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" : "bg-gray-50"}`}>

        {/* Top bar */}
        <header className={`h-14 flex items-center justify-between px-6 border-b backdrop-blur-sm shrink-0 transition-colors duration-300 ${dark ? "border-white/5 bg-slate-950/60" : "border-gray-200 bg-white/80"}`}>
          <div className="flex items-center gap-3">
            <h1 className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
              {selectedCourse || "Select a course"}
            </h1>
            {selectedCourse && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/20">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${dark ? "bg-white/5 border-white/5 text-slate-500" : "bg-gray-100 border-gray-200 text-gray-500"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </header>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto chat-scroll">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-1">
            {/* Empty state */}
            {chatHistory.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl text-white mb-5 shadow-xl shadow-indigo-500/20">
                  M
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>
                  How can I help you today?
                </h2>
                <p className={`text-sm max-w-md ${dark ? "text-slate-500" : "text-gray-500"}`}>
                  Ask me anything about {selectedCourse || "your courses"}. I can help with lecture content, concepts, and finding relevant recordings.
                </p>
              </div>
            )}

            {/* Messages */}
            {chatHistory.map((msg, index) => {
              const isUser = msg.sender === "user";
              return (
                <div key={index} className="msg-animate">
                  {/* Message row */}
                  <div className={`flex gap-3 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white ${
                      isUser
                        ? "bg-linear-to-br from-blue-500 to-cyan-500"
                        : "bg-linear-to-br from-indigo-500 to-violet-600"
                    }`}>
                      {isUser ? "Y" : "AI"}
                    </div>

                    {/* Bubble */}
                    <div className={`max-w-[75%] min-w-0 ${isUser ? "text-right" : ""}`}>
                      <div className={`inline-block rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                        isUser
                          ? "bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-md"
                          : dark
                            ? "bg-white/7 text-slate-200 border border-white/10 rounded-tl-md backdrop-blur-sm"
                            : "bg-white text-gray-800 border border-gray-200 rounded-tl-md shadow-sm"
                      }`}>
                        <span className="whitespace-pre-wrap wrap-break-word">
                          {isUser ? msg.text : renderMessageText(msg.text, dark)}
                        </span>
                      </div>
                      {msg.time && (
                        <p className={`text-[10px] mt-1 ${dark ? "text-slate-600" : "text-gray-400"} ${isUser ? "pr-1" : "pl-1"}`}>
                          {formatTime(msg.time)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="msg-animate flex gap-3 py-3">
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  AI
                </div>
                <div className={`px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-1.5 ${dark ? "bg-white/7 border border-white/10 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-sm"}`}>
                  <span className={`typing-dot w-2 h-2 rounded-full ${dark ? "bg-slate-400" : "bg-gray-400"}`} />
                  <span className={`typing-dot w-2 h-2 rounded-full ${dark ? "bg-slate-400" : "bg-gray-400"}`} />
                  <span className={`typing-dot w-2 h-2 rounded-full ${dark ? "bg-slate-400" : "bg-gray-400"}`} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ───── Input Area ───── */}
        <div className={`shrink-0 border-t backdrop-blur-sm transition-colors duration-300 ${dark ? "border-white/5 bg-slate-950/80" : "border-gray-200 bg-white/80"}`}>
          <form
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto px-6 py-4"
          >
            <div className={`flex items-end gap-3 rounded-2xl px-4 py-3 border transition-all ${dark ? "bg-white/6 border-white/10 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/25" : "bg-gray-100 border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/25 focus-within:bg-white"}`}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Message Motus about ${selectedCourse}...`}
                className={`flex-1 bg-transparent text-sm focus:outline-none min-w-0 ${dark ? "text-white placeholder:text-slate-500" : "text-gray-900 placeholder:text-gray-400"}`}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className={`text-[10px] text-center mt-2 ${dark ? "text-slate-600" : "text-gray-400"}`}>
              Motus can make mistakes. Verify important info with your course materials.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CourseTutorMVP;
