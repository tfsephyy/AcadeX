import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChatbotContext } from '../context/ChatbotContext';
import api from '../api/axios';

// ─── Simple markdown renderer ─────────────────────────────────────────────────
// Converts **bold**, *italic*, `code`, bullet lists, and numbered lists
// to HTML elements — no external dependency needed.
function renderMarkdown(text) {
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let listType = null; // 'ul' | 'ol'
    let key = 0;

    const flushList = () => {
        if (listItems.length === 0) return;
        const Tag = listType === 'ul' ? 'ul' : 'ol';
        elements.push(
            <Tag key={`list-${key++}`}>
                {listItems.map((li, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(li) }} />
                ))}
            </Tag>
        );
        listItems = [];
        listType = null;
    };

    lines.forEach((line) => {
        const ulMatch = line.match(/^[\*\-]\s+(.*)/);
        const olMatch = line.match(/^\d+\.\s+(.*)/);

        if (ulMatch) {
            if (listType === 'ol') flushList();
            listType = 'ul';
            listItems.push(ulMatch[1]);
            return;
        }
        if (olMatch) {
            if (listType === 'ul') flushList();
            listType = 'ol';
            listItems.push(olMatch[1]);
            return;
        }

        flushList();

        if (line.trim() === '') {
            elements.push(<br key={`br-${key++}`} />);
            return;
        }

        // Strip [ID:N] tags from visible text (they're handled separately)
        const cleanLine = line.replace(/\[ID:\d+\]/g, '');
        elements.push(
            <p key={`p-${key++}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(cleanLine) }} />
        );
    });

    flushList();
    return elements;
}

function inlineMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ─── Helper: format timestamp ─────────────────────────────────────────────────
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Quick-action suggestion chips ───────────────────────────────────────────
const DEFAULT_CHIPS = [
    'What capstones are about machine learning?',
    'Find IoT-related capstones',
    'Show me recent BSIT capstones',
    'What is this capstone about?',
];

// ─── Chatbot Component ────────────────────────────────────────────────────────
export default function Chatbot() {
    const { user } = useAuth();
    const { capstoneContext } = useChatbotContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState(0);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // When panel opens, reset unread counter
    useEffect(() => {
        if (open) setUnread(0);
    }, [open]);

    // Auto-resize textarea
    const handleInputChange = (e) => {
        setInput(e.target.value);
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 112) + 'px';
        }
    };

    // Determine role-based capstone path prefix
    const getCapstoneRoute = (id) => {
        const path = location.pathname;
        if (path.startsWith('/admin')) return `/admin/capstones/${id}`;
        if (path.startsWith('/faculty')) return `/faculty/capstones/${id}`;
        return `/student/capstones/${id}`;
    };

    // Build conversation history for the API (last 10 turns)
    const buildHistory = (msgs) =>
        msgs.slice(-10).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
        }));

    const sendMessage = useCallback(async (messageText) => {
        const text = (messageText ?? input).trim();
        if (!text || loading) return;

        const userMsg = {
            id: Date.now(),
            role: 'user',
            text,
            time: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setLoading(true);

        try {
            const payload = {
                message: text,
                conversation_history: buildHistory([...messages, userMsg]),
            };
            if (capstoneContext?.id) {
                payload.capstone_id = capstoneContext.id;
            }

            const res = await api.post('/chatbot/message', payload);
            const { reply, suggested_capstones } = res.data.data;

            const botMsg = {
                id: Date.now() + 1,
                role: 'bot',
                text: reply,
                time: new Date(),
                suggestions: suggested_capstones ?? [],
            };

            setMessages((prev) => [...prev, botMsg]);
            if (!open) setUnread((n) => n + 1);
        } catch (err) {
            const errText =
                err?.response?.data?.message ||
                'Something went wrong. Please try again.';
            const errMsg = {
                id: Date.now() + 1,
                role: 'bot',
                text: errText,
                time: new Date(),
                isError: true,
                suggestions: [],
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, capstoneContext, open]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleChip = (chip) => sendMessage(chip);

    const handleClear = () => setMessages([]);

    if (!user) return null;

    return (
        <>
            {/* ── Floating Action Button ──────────────────────────────── */}
            <button
                id="chatbot-fab"
                className="chatbot-fab"
                onClick={() => setOpen((o) => !o)}
                title="EduBot — AI Capstone Assistant"
            >
                {open ? (
                    // X icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                         style={{ width: '1.25rem', height: '1.25rem' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    // Chat icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"
                         style={{ width: '1.35rem', height: '1.35rem' }}>
                        <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                )}
                {/* Unread badge */}
                {!open && unread > 0 && (
                    <span className="chatbot-fab-badge">{unread}</span>
                )}
            </button>

            {/* ── Chat Panel ──────────────────────────────────────────── */}
            {open && (
                <div id="chatbot-panel" className="chatbot-panel">

                    {/* Header */}
                    <div className="chatbot-header">
                        <div className="chatbot-header-avatar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"
                                 style={{ width: '1.1rem', height: '1.1rem' }}>
                                <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </div>
                        <div className="chatbot-header-info">
                            <div className="chatbot-header-name">EduBot</div>
                            <div className="chatbot-header-status">
                                <span className="chatbot-status-dot" />
                                AI Capstone Assistant
                            </div>
                        </div>
                        {/* Clear button */}
                        {messages.length > 0 && (
                            <button
                                onClick={handleClear}
                                className="chatbot-header-close"
                                title="Clear conversation"
                                style={{ marginRight: '0.2rem' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                     style={{ width: '1rem', height: '1rem' }}>
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4h6v2" />
                                </svg>
                            </button>
                        )}
                        <button
                            id="chatbot-close-btn"
                            className="chatbot-header-close"
                            onClick={() => setOpen(false)}
                            title="Close"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                                 style={{ width: '1rem', height: '1rem' }}>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Capstone context pill */}
                    {capstoneContext?.title && (
                        <div className="chatbot-context-pill" style={{ marginTop: '0.6rem' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                 style={{ width: '0.8rem', height: '0.8rem', flexShrink: 0 }}>
                                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                            </svg>
                            <span>Context: {capstoneContext.title}</span>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="chatbot-messages" id="chatbot-messages">
                        {messages.length === 0 ? (
                            /* Empty state */
                            <div className="chatbot-empty">
                                <div className="chatbot-empty-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                         style={{ width: '1.5rem', height: '1.5rem' }}>
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                                    </svg>
                                </div>
                                <div className="chatbot-empty-title">Hi, I'm EduBot! 👋</div>
                                <div className="chatbot-empty-desc">
                                    Ask me anything about capstone projects — find ones that match your needs, explore topics, or learn about a specific capstone.
                                </div>
                                <div className="chatbot-chips">
                                    {(capstoneContext?.title
                                        ? ['What is this capstone about?', 'Who are the authors?', 'What are the keywords?', 'Find related capstones']
                                        : DEFAULT_CHIPS
                                    ).map((chip) => (
                                        <button
                                            key={chip}
                                            className="chatbot-chip"
                                            onClick={() => handleChip(chip)}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`chatbot-msg ${msg.role}`}
                                >
                                    {/* Avatar */}
                                    <div className={`chatbot-msg-avatar ${msg.role}`}>
                                        {msg.role === 'bot' ? 'EB' : (user?.name?.charAt(0)?.toUpperCase() || 'U')}
                                    </div>

                                    {/* Body */}
                                    <div className="chatbot-msg-body">
                                        <div className={`chatbot-bubble ${msg.role} ${msg.isError ? 'chatbot-error' : ''}`}>
                                            {msg.role === 'bot'
                                                ? renderMarkdown(msg.text)
                                                : msg.text
                                            }
                                        </div>

                                        {/* Suggested capstone cards */}
                                        {msg.role === 'bot' && msg.suggestions?.length > 0 && (
                                            <div className="chatbot-suggestions">
                                                {msg.suggestions.map((cap) => (
                                                    <button
                                                        key={cap.id}
                                                        className="chatbot-suggestion-card"
                                                        onClick={() => {
                                                            setOpen(false);
                                                            navigate(getCapstoneRoute(cap.id));
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                                             style={{ width: '0.9rem', height: '0.9rem', color: 'var(--chat-tag-text)', flexShrink: 0, marginTop: '1px' }}>
                                                            <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                                                        </svg>
                                                        <div>
                                                            <div className="chatbot-suggestion-title">{cap.title}</div>
                                                            <div className="chatbot-suggestion-meta">
                                                                {cap.author} · {cap.year} · {cap.program}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="chatbot-msg-time">{formatTime(msg.time)}</div>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Typing indicator */}
                        {loading && (
                            <div className="chatbot-typing">
                                <div className="chatbot-msg-avatar bot">EB</div>
                                <div className="chatbot-typing-dots">
                                    <div className="chatbot-typing-dot" />
                                    <div className="chatbot-typing-dot" />
                                    <div className="chatbot-typing-dot" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="chatbot-input-area">
                        <textarea
                            ref={textareaRef}
                            id="chatbot-input"
                            className="chatbot-textarea"
                            rows={1}
                            placeholder="Ask about capstone projects…"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                        />
                        <button
                            id="chatbot-send-btn"
                            className="chatbot-send-btn"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || loading}
                            title="Send message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"
                                 style={{ width: '1.1rem', height: '1.1rem' }}>
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
