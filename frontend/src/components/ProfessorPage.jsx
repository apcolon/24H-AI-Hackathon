import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/App.css";

const ProfessorPage = () => {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // State for metrics and topics - ready to connect to DB
  const [metrics, setMetrics] = useState([
    { label: "All Classes", value: "0", subtext: "Total courses" },
    { label: "Total Questions", value: "0", subtext: "From students" },
    { label: "Active Students", value: "0", subtext: "Asking questions" },
    { label: "Top Topic", value: "—", subtext: "Most asked about" },
  ]);

  const [topics, setTopics] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [lectures, setLectures] = useState([]);

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);


  useEffect(() => {
    const fetchData = async () => {
      const metricsRes = await fetch('/api/professor/metrics');
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);
  
      const topicsRes = await fetch('/api/professor/topics');
      const topicsData = await topicsRes.json();
      setTopics(topicsData);
    };
    fetchData();
  }, []);

  // Fetch available courses for dropdown
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch('/api/get_classes');
        const data = await res.json();
        const list = (data.classes || []).map((c) => ({ label: c, value: c }));
        setCourses(list);
        if (list.length > 0 && !selectedCourse) setSelectedCourse(list[0].value);
      } catch (e) {
        console.error('Failed to load courses', e);
        setCourses([]);
      }
    };
    loadCourses();
  }, []);

  // Fetch lectures heatmap for selected course
  useEffect(() => {
    if (!selectedCourse) return;
    const loadHeatmap = async () => {
      try {
        const res = await fetch(`/api/professor/heatmap?course=${encodeURIComponent(selectedCourse)}`);
        if (!res.ok) throw new Error('no heatmap endpoint');
        const data = await res.json();
        setLectures(data.lectures || []);
      } catch (e) {
        console.error('Failed to load heatmap', e);
        setLectures([]);
      }
    };
    loadHeatmap();
  }, [selectedCourse]);

  // color map: value(0..max) -> css color string (green->red)
  const colorFor = (value, max) => {
    if (max <= 0) return '#0f9';
    const ratio = Math.min(1, value / max);
    // hue from 120 (green) -> 0 (red)
    const hue = 120 - 120 * ratio;
    return `hsl(${hue}deg 80% ${40 + 20 * (1 - ratio)}%)`;
  };

  const formatChunkLabel = (idx) => {
    const minutes = idx * 5;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-[Inter,system-ui,sans-serif] ${dark ? "bg-slate-950" : "bg-gray-50"}`}>
      {/* Header */}
      <header className={`border-b backdrop-blur-sm transition-colors duration-300 ${dark ? "border-white/5 bg-slate-950/60" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${dark ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>Professor Portal</h1>
              <p className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>View student questions and prepare lectures</p>
            </div>
          </div>
          <button
            onClick={() => setDark((v) => !v)}
            className={`p-2 rounded-xl border transition-all ${dark ? "border-white/10 text-slate-400 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"}`}
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-xl border transition-colors ${dark ? "bg-slate-900/50 border-white/10 hover:border-white/20" : "bg-white border-gray-200 hover:border-gray-300"}`}
            >
              <p className={`text-sm font-medium mb-2 ${dark ? "text-slate-400" : "text-gray-600"}`}>
                {metric.label}
              </p>
              <p className={`text-3xl font-bold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>
                {metric.value}
              </p>
              <p className={`text-xs ${dark ? "text-slate-500" : "text-gray-500"}`}>
                {metric.subtext}
              </p>
            </div>
          ))}
        </div>

        {/* Question Trends Section */}
        <div>
          <h2 className={`text-xl font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>Question Trends</h2>
          <p className={`text-sm mb-6 ${dark ? "text-slate-400" : "text-gray-600"}`}>
            Topics students are asking about most frequently
          </p>

          {/* Professor Heatmap Controls */}
          <div className="mb-6 flex items-center gap-4">
            <label className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>Select course:</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className={`px-3 py-2 rounded-md border ${dark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
            >
              {courses.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Heatmap List */}
          <div className="space-y-4">
            {lectures.length === 0 ? (
              <div className={`p-6 rounded-xl border ${dark ? "bg-slate-900/50 border-white/10" : "bg-white border-gray-200"}`}>
                <p className={`${dark ? "text-slate-400" : "text-gray-600"}`}>No lectures found for this course.</p>
              </div>
            ) : (
              lectures.map((lec) => {
                const chunks = lec.counts || [];
                const max = Math.max(...chunks, 1);
                return (
                  <div key={lec.id} className={`p-4 rounded-xl border ${dark ? "bg-slate-900/50 border-white/10" : "bg-white border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className={`${dark ? "text-white" : "text-gray-900"} font-semibold`}>Lecture — {lec.date}</h3>
                        <p className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>{lec.duration_minutes} minutes</p>
                      </div>
                      <div className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>{chunks.reduce((a,b)=>a+b,0)} questions</div>
                    </div>

                    {/* heatmap bar */}
                    <div className="w-full h-10 rounded-lg overflow-hidden border" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                      <div className="flex h-full">
                        {chunks.map((count, idx) => (
                          <div
                            key={idx}
                            title={`${formatChunkLabel(idx)} — ${count} question${count!==1? 's':''}`}
                            style={{
                              background: colorFor(count, max),
                              width: `${100 / chunks.length}%`,
                              transition: 'background-color 200ms',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* optional legend */}
                    <div className="flex items-center gap-2 mt-3 text-xs">
                      <div className="flex-1 text-sm text-gray-500">Low</div>
                      <div className="flex-1 h-2 rounded bg-gradient-to-r from-green-400 to-red-500" />
                      <div className="flex-1 text-right text-sm text-gray-500">High</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Topics */}
          <div className="space-y-4">
            {topics.length === 0 ? (
              <div className={`p-12 rounded-xl border text-center ${dark ? "bg-slate-900/50 border-white/10" : "bg-white border-gray-200"}`}>
                <p className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>
                  No topics yet. Connect to your database to see student questions.
                </p>
              </div>
            ) : (
              topics.map((topic, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-xl border transition-colors ${dark ? "bg-slate-900/50 border-white/10" : "bg-white border-gray-200"}`}
                >
                  {/* Topic Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>
                        {topic.name}
                      </h3>
                      <p className={`text-sm ${dark ? "text-slate-400" : "text-gray-600"}`}>
                        {topic.count} question{topic.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${dark ? "text-indigo-400" : "text-indigo-600"}`}>
                        {topic.percentage}%
                      </p>
                      <p className={`text-xs ${dark ? "text-slate-500" : "text-gray-500"}`}>
                        of total
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className={`w-full h-1.5 rounded-full mb-4 overflow-hidden ${dark ? "bg-white/5" : "bg-gray-100"}`}>
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all"
                      style={{ width: `${topic.percentage}%` }}
                    />
                  </div>

                  {/* Questions List */}
                  <div className="space-y-2">
                    {topic.questions && topic.questions.map((question, qIdx) => (
                      <div
                        key={qIdx}
                        className={`p-3 rounded-lg text-sm ${dark ? "bg-white/5 text-slate-300" : "bg-gray-50 text-gray-700"}`}
                      >
                        "{question}"
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfessorPage;
