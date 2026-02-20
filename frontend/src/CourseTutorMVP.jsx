import React, { useState, useEffect, useRef } from 'react';

const CourseTutorMVP = () => {
    // --- State Management ---
    const [classes, setClasses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const chatEndRef = useRef(null);
    // --- API Calls ---

    // 1. /api/get_classes
    useEffect(() => {
        const fetchClasses = async () => {
            const response = await fetch('/api/get_classes', { credentials: 'include' });
            const data = await response.json();
            setClasses(data.classes);
            if (data.classes.length > 0) setSelectedCourse(data.classes[0]);
        };
        fetchClasses();
    }, []);

    // 2. /api/chat_history
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedCourse) return;
            const response = await fetch(
                `/api/chat_history?course=${encodeURIComponent(selectedCourse)}`,
                { credentials: 'include' }
            );
            const data = await response.json();
            setChatHistory(data.results);
        };
        fetchHistory();
    }, [selectedCourse]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // 3. /api/send_message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        // Optimistically add user message to UI
        const newMessage = {
            time: new Date().toISOString(),
            sender: "user",
            text: inputMessage
        };
        setChatHistory(prev => [...prev, newMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/send_message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ course: selectedCourse, prompt: newMessage.text }),
            });
            const data = await response.json();
            const agentResponse = {
                time: new Date().toISOString(),
                sender: 'agent',
                text: data.reply,
            };
            setChatHistory(prev => [...prev, agentResponse]);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render UI ---
    return (
        <div className="flex h-screen bg-gray-50 font-sans">

            {/* Sidebar: Class Selection */}
            <div className="w-64 bg-gray-900 text-white flex flex-col">
                <div className="p-4 text-xl font-bold border-b border-gray-700">
                    CourseTutor AI
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    <h2 className="text-sm text-gray-400 mb-3 uppercase tracking-wider">Your Classes</h2>
                    <ul>
                        {classes.map((courseName) => (
                            <li key={courseName} className="mb-2">
                                <button
                                    onClick={() => setSelectedCourse(courseName)}
                                    className={`w-full text-left px-3 py-2 rounded transition-colors ${selectedCourse === courseName ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                                >
                                    {courseName}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">

                {/* Header */}
                <div className="bg-white border-b p-4 shadow-sm flex justify-between items-center">
                    <h1 className="text-lg font-semibold text-gray-800">
                        {selectedCourse} - Digital Assistant
                    </h1>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">MVP Demo</span>
                </div>

                {/* Chat History */}
                <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-lg p-4 shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="bg-white text-gray-500 border border-gray-200 p-4 rounded-lg rounded-bl-none shadow-sm animate-pulse">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white border-t p-4">
                    <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder={`Ask a question about ${selectedCourse}...`}
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !inputMessage.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default CourseTutorMVP;