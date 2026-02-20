import { useState } from "react";

export default function App() {
  const [text, setText] = useState("Yo! This is working.");

  async function playTTS(t: string) {
    const res = await fetch("http://127.0.0.1:8000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    new Audio(url).play();
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>TTS Demo</h1>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: 400, padding: 8 }}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={() => playTTS(text)}>Speak</button>
      </div>
    </div>
  );
}