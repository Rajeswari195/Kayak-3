import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/ui/button';
import { Bot, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/use-auth';
import { getToken } from '@/lib/auth-storage';

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth(); // Track user login state
    const token = getToken(); // Get token directly from storage
    const [messages, setMessages] = useState([
        { text: "Hi! I'm your AI Concierge. How can I help you plan your trip today?", isUser: false, actions: [] }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const clientId = useRef(Math.floor(Math.random() * 1000000));

    useEffect(() => {
        if (isOpen && !ws.current) {
            // FIX: Use relative URL routing through Vite Proxy to handle port/CORS/IPv6 automatically
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/concierge/${clientId.current}`;
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log('Connected to AI Service');
                setIsConnected(true);
                if (token) {
                    socket.send(`AUTH_TOKEN:${token}`);
                }
            };

            socket.onmessage = (event) => {
                let content = { text: event.data, isUser: false, actions: [] };
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.text) {
                        content.text = parsed.text;
                        content.actions = parsed.actions || [];
                    }
                } catch (e) {
                    // Plain text fallback
                }
                setMessages((prev) => [...prev, content]);
            };

            socket.onclose = () => {
                console.log('Disconnected from AI Service');
                setIsConnected(false);
                ws.current = null;
            };

            ws.current = socket;
        }

        return () => {
            if (ws.current && !isOpen) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [isOpen]);

    useEffect(() => {
        const currentToken = getToken();
        if (isConnected && ws.current && currentToken) {
            ws.current.send(`AUTH_TOKEN:${currentToken}`);
        }
    }, [user, isConnected]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = () => {
        if (!inputValue.trim() || !ws.current) return;
        setMessages((prev) => [...prev, { text: inputValue, isUser: true }]);
        ws.current.send(inputValue);
        setInputValue("");
    };

    const handleActionClick = (actionText) => {
        if (!ws.current) return;
        setMessages((prev) => [...prev, { text: actionText, isUser: true }]);
        ws.current.send(actionText);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {isOpen && (
                <div className="w-[350px] h-[500px] bg-background border rounded-lg shadow-xl flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-200">
                    {/* Header */}
                    <div className="p-4 border-b flex items-center justify-between bg-primary text-primary-foreground rounded-t-lg">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5" />
                            <span className="font-semibold">AI Concierge</span>
                            {isConnected && <span className="w-2 h-2 bg-green-400 rounded-full ml-2 animate-pulse" title="Connected"></span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary/80 hover:text-white" onClick={() => setIsOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn("flex flex-col gap-2", msg.isUser ? "items-end" : "items-start")}>
                                <div
                                    className={cn(
                                        "max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap",
                                        msg.isUser
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-muted text-foreground rounded-bl-none"
                                    )}
                                >
                                    {msg.text}
                                </div>

                                {/* Render Actions (Chips) */}
                                {!msg.isUser && msg.actions && msg.actions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {msg.actions.map((action, actionIdx) => (
                                            <button
                                                key={actionIdx}
                                                onClick={() => handleActionClick(action)}
                                                className="text-xs border border-primary text-primary hover:bg-primary/10 px-3 py-1 rounded-full transition-colors bg-background"
                                            >
                                                {action}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t gap-2 flex items-end">
                        <textarea
                            placeholder="Ask me anything..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            disabled={!isConnected}
                            className="flex-1 min-h-[40px] max-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                            rows={1}
                        />
                        <Button size="icon" onClick={sendMessage} disabled={!isConnected}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Button
                size="icon"
                className={cn(
                    "h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105",
                    isOpen ? "hidden" : "flex"
                )}
                onClick={() => setIsOpen(true)}
            >
                <Bot className="w-8 h-8" />
            </Button>
        </div>
    );
}
