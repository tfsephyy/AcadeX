import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChatbotContext } from '../context/ChatbotContext';
import api from '../api/axios';

// ─── Simple markdown renderer ─────────────────────────────────────────────────
// Converts **bold**, *italic*, `code`, bullet lists, and numbered lists
// to HTML elements — no external dependency needed.
// linkRenderer(id) → called for [LINK:id] tags to produce a clickable element.
function renderMarkdown(text, linkRenderer) {
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];   // each entry: string (plain) or React element
    let listType = null;  // 'ul' | 'ol'
    let key = 0;

    const flushList = () => {
        if (listItems.length === 0) return;
        const Tag = listType === 'ul' ? 'ul' : 'ol';
        elements.push(
            <Tag key={`list-${key++}`}>
                {listItems.map((li, i) =>
                    typeof li === 'string'
                        ? <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(li) }} />
                        : <li key={i}>{li}</li>
                )}
            </Tag>
        );
        listItems = [];
        listType = null;
    };

    // Parse a text fragment that may contain [LINK:N] into React nodes
    const parseWithLinks = (raw) => {
        const linkRx = /\[LINK:(\d+)\]/g;
        const parts = [];
        let last = 0;
        let m;
        while ((m = linkRx.exec(raw)) !== null) {
            if (m.index > last) {
                parts.push(
                    <span key={`t-${key++}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(raw.slice(last, m.index)) }} />
                );
            }
            const capId = parseInt(m[1], 10);
            if (linkRenderer) parts.push(linkRenderer(capId, key++));
            last = m.index + m[0].length;
        }
        if (last < raw.length) {
            parts.push(
                <span key={`t-${key++}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(raw.slice(last)) }} />
            );
        }
        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    const hasLink = (s) => /\[LINK:\d+\]/.test(s);

    lines.forEach((line) => {
        const ulMatch = line.match(/^[\*\-]\s+(.*)/);
        const olMatch = line.match(/^\d+\.\s+(.*)/);

        if (ulMatch) {
            if (listType === 'ol') flushList();
            listType = 'ul';
            const content = ulMatch[1];
            listItems.push(hasLink(content) && linkRenderer ? parseWithLinks(content) : content);
            return;
        }
        if (olMatch) {
            if (listType === 'ul') flushList();
            listType = 'ol';
            const content = olMatch[1];
            listItems.push(hasLink(content) && linkRenderer ? parseWithLinks(content) : content);
            return;
        }

        flushList();

        if (line.trim() === '') {
            elements.push(<br key={`br-${key++}`} />);
            return;
        }

        // Check for [LINK:id] tags — render title as a clickable link
        if (hasLink(line) && linkRenderer) {
            elements.push(<p key={`p-${key++}`}>{parseWithLinks(line)}</p>);
            return;
        }

        // Strip [ID:N] tags from visible text (legacy — kept for safety)
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
        .replace(/\*(.+?)\*/g,   '<em>$1</em>')
        .replace(/`(.+?)`/g,     '<code>$1</code>');
}

// ─── Helper: format timestamp ─────────────────────────────────────────────────
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_DEFINITIONS = [
    { q: 'What is IMRAD?', icon: '📄' },
    { q: 'What is an abstract in a research paper?', icon: '📝' },
    { q: 'What is the difference between a capstone and a thesis?', icon: '🎓' },
    { q: 'What does publication status mean?', icon: '📰' },
    { q: 'What does copyright status mean for a capstone?', icon: '©️' },
    { q: 'What is the difference between archived and published?', icon: '📦' },
    { q: 'What does it mean when my capstone is pending?', icon: '⏳' },
    { q: 'What is the role of an adviser in a capstone project?', icon: '👨‍🏫' },
    { q: 'What are keywords and why do they matter in research?', icon: '🏷️' },
    { q: 'What does approval status mean?', icon: '✅' },
    { q: 'What formats are accepted for capstone uploads?', icon: '📁' },
];

const FAQ_DYNAMIC = [
    { q: 'What are the top 3 most viewed capstones?', icon: '👁️' },
    { q: 'What is the top most downloaded capstones?', icon: '⬇️' },
    { q: 'What is the most bookmarked capstones this year?', icon: '🔖' },
    { q: 'Which program has the most capstone submissions?', icon: '🏆' },
    { q: 'Which year had the most capstone submissions?', icon: '📅' },
];

const FAQ_STUDENT = [
    { q: 'What capstones has my adviser supervised before?', icon: '👨‍🏫' },
    { q: 'What is the most popular research topic?', icon: '🔥' },
    { q: 'How has the number of capstone submissions changed over the years?', icon: '📅' },
    { q: 'Which advisers handle the most research projects?', icon: '🏆' },
    { q: 'What is the most referenced capstone?', icon: '🔗' },
    { q: 'Find capstones about machine learning', icon: '🤖' },
    { q: 'Recommend a capstone topic related to healthcare', icon: '🏥' },
    { q: 'Find capstones about IoT or embedded systems', icon: '📡' },
];

const FAQ_FACULTY = [
    { q: 'What is the most viewed title capstone among I advised?', icon: '👁️' },
    { q: 'Are there capstone topics in my advisory that have been overdone?', icon: '⚠️' },
    { q: 'How many capstone have I advised across all years?', icon: '📊' },
    { q: 'Find capstones in my advisory that has been published.', icon: '📰' },
    { q: 'Find capstones in my advisory that has been copyrighted', icon: '©️' },
    { q: 'Show All the capstone I have advised for the past 3 years', icon: '📅' },
];

const FAQ_ADMIN = [
    { q: 'How many capstones are in the archive in total?', icon: '📚' },
    { q: 'How many users are registered by role?', icon: '👥' },
    { q: 'Show recent login activity', icon: '🔒' },
    { q: 'Which capstones have never been viewed since publishing?', icon: '👻' },
    { q: 'How many capstone has no IMRAD attached?', icon: '📭' },
    { q: 'Which users have never logged in since registering?', icon: '🔐' },
    { q: 'Who are the most active users this month?', icon: '🔥' },
    { q: 'How many capstones are published?', icon: '📰' },
    { q: 'How many capstone are copyrighted?', icon: '©️' },
];

const FAQ_CONTEXT = [
    { q: 'What is this capstone about?', icon: '📋' },
    { q: 'Who advised this capstone?', icon: '👨‍🏫' },
    { q: 'What keywords describe this capstone?', icon: '🏷️' },
    { q: 'Find capstones related to this one', icon: '🔗' },
    { q: 'What is the publication and copyright status of this?', icon: '©️' },
    { q: 'When was this capstone approved?', icon: '✅' },
    { q: 'How does this capstone compare in views to others in its program?', icon: '📊' },
];

// Build tab structure per role
const TABS_BY_ROLE = {
    student: [
        { id: 'definitions', label: 'Definitions', icon: '📖', questions: FAQ_DEFINITIONS },
        { id: 'discover',    label: 'Discover',    icon: '📊', questions: FAQ_DYNAMIC },
        { id: 'student',     label: 'My Research', icon: '🎓', questions: FAQ_STUDENT },
    ],
    faculty: [
        { id: 'definitions', label: 'Definitions', icon: '📖', questions: FAQ_DEFINITIONS },
        { id: 'discover',    label: 'Discover',    icon: '📊', questions: FAQ_DYNAMIC },
        { id: 'faculty',     label: 'My Program',  icon: '🏫', questions: FAQ_FACULTY },
    ],
    admin: [
        { id: 'definitions', label: 'Definitions', icon: '📖', questions: FAQ_DEFINITIONS },
        { id: 'discover',    label: 'Discover',    icon: '📊', questions: FAQ_DYNAMIC },
        { id: 'admin',       label: 'System',      icon: '🔐', questions: FAQ_ADMIN },
    ],
    visitor: [
        { id: 'definitions', label: 'Definitions', icon: '📖', questions: FAQ_DEFINITIONS },
        { id: 'discover',    label: 'Discover',    icon: '📊', questions: FAQ_DYNAMIC },
    ],
};

const ROLE_SUBTITLE = {
    admin:   'System Assistant Chatbot',
    faculty: 'Capstone Research Assistant',
    student: 'Capstone Research Assistant',
    visitor: 'Browse Available Capstones',
};

// ─── FAQ Panel (replaces old empty state) ────────────────────────────────────
function FaqPanel({ role, capstoneContext, onAsk, filter }) {
    const [activeTab, setActiveTab] = useState('definitions');

    const tabs = TABS_BY_ROLE[role] ?? TABS_BY_ROLE.visitor;

    const currentQuestions = tabs.find(t => t.id === activeTab)?.questions ?? [];

    // Filter by the bottom textarea value
    const filtered = filter.trim()
        ? currentQuestions.filter(item =>
            item.q.toLowerCase().includes(filter.trim().toLowerCase())
          )
        : currentQuestions;

    return (
        <div className="faq-panel">

            {/* Role tabs */}
            <div className="faq-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`faq-tab${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Question list */}
            <div className="faq-list">
                {filtered.length === 0 ? (
                    <div className="faq-empty-search">
                        {filter.trim()
                            ? <>No questions match — press <strong>Enter</strong> to ask it directly.</>
                            : 'No questions available.'}
                    </div>
                ) : (
                    filtered.map((item, i) => (
                        <button
                            key={i}
                            className="faq-item"
                            onClick={() => onAsk(item.q)}
                        >
                            <span className="faq-item-icon">{item.icon}</span>
                            <span className="faq-item-text">{item.q}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                 className="faq-item-arrow">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

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
    const [showFaqDrawer, setShowFaqDrawer] = useState(false); // FAQ drawer in mid-conversation
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fabRef = useRef(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // When panel opens, reset unread counter
    useEffect(() => {
        if (open) setUnread(0);
    }, [open]);

    // Load saved position from localStorage; clear any stale 'hidden' flag
    useEffect(() => {
        // Always clear hidden state — if the FAB was hidden the user has no way to find it
        localStorage.removeItem('chatbot_hidden');

        const savedPosition = localStorage.getItem('chatbot_position');
        if (savedPosition) {
            try {
                const pos = JSON.parse(savedPosition);
                // Clamp to keep FAB inside viewport (fab is ~56px = 3.5rem)
                const FAB = 56;
                const maxX = window.innerWidth  - FAB - 28; // 28 = 1.75rem right
                const maxY = window.innerHeight - FAB - 28;
                const minX = -(window.innerWidth  - FAB - 28);
                const minY = -(window.innerHeight - FAB - 28);
                const clamped = {
                    x: Math.max(minX, Math.min(maxX, pos.x ?? 0)),
                    y: Math.max(minY, Math.min(maxY, pos.y ?? 0)),
                };
                setPosition(clamped);
            } catch (e) {
                localStorage.removeItem('chatbot_position');
            }
        }
    }, []);

    // Handle mouse/touch drag for FAB
    useEffect(() => {
        const handleMove = (e) => {
            if (!isDragging) return;

            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            const FAB = 56;
            const maxX = window.innerWidth  - FAB - 28;
            const maxY = window.innerHeight - FAB - 28;
            const minX = -(window.innerWidth  - FAB - 28);
            const minY = -(window.innerHeight - FAB - 28);

            const newX = Math.max(minX, Math.min(maxX, clientX - dragStart.x));
            const newY = Math.max(minY, Math.min(maxY, clientY - dragStart.y));

            // Check if user has moved more than 5px (to distinguish from click)
            if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
                setHasMoved(true);
            }

            setPosition({ x: newX, y: newY });
        };

        const handleEnd = () => {
            if (isDragging) {
                setIsDragging(false);
                // Save position to localStorage
                localStorage.setItem('chatbot_position', JSON.stringify(position));
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleMove);
            document.addEventListener('touchend', handleEnd);

            return () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
                document.removeEventListener('touchmove', handleMove);
                document.removeEventListener('touchend', handleEnd);
            };
        }
    }, [isDragging, dragStart, position]);

    const handleDragStart = (e) => {
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        setIsDragging(true);
        setHasMoved(false); // Reset movement flag
        setDragStart({
            x: clientX - position.x,
            y: clientY - position.y
        });
    };

    const handleFabClick = (e) => {
        // Only toggle open/close if user didn't drag
        if (!hasMoved) {
            setOpen((o) => !o);
        }
        setHasMoved(false); // Reset for next interaction
    };

    // Auto-resize textarea
    const handleInputChange = (e) => {
        setInput(e.target.value);
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 112) + 'px';
        }
    };

    // Determine role from URL path (same logic used elsewhere in the app)
    const getRoleFromPath = () => {
        const path = location.pathname;
        if (path.startsWith('/admin'))   return 'admin';
        if (path.startsWith('/faculty')) return 'faculty';
        if (path.startsWith('/visitor')) return 'visitor';
        if (path.startsWith('/student')) return 'student';
        return 'student'; // safe default for authenticated users
    };
    const currentRole = getRoleFromPath();

    // Determine role-based capstone path prefix
    const getCapstoneRoute = (id) => {
        if (currentRole === 'admin')   return `/admin/capstones/${id}`;
        if (currentRole === 'faculty') return `/faculty/capstones/${id}`;
        if (currentRole === 'visitor') return `/visitor/capstones/${id}`;
        return `/student/capstones/${id}`;
    };

    // Build conversation history for the API (last 10 turns)
    const buildHistory = (msgs) =>
        msgs.slice(-10).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
        }));

    const sendMessage = useCallback(async (messageText, extraPayload = {}) => {
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
        setShowFaqDrawer(false); // hide drawer when a message is sent
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setLoading(true);

        try {
            const payload = {
                message: text,
                conversation_history: buildHistory([...messages, userMsg]),
                ...extraPayload,
            };
            if (capstoneContext?.id) {
                payload.capstone_id = capstoneContext.id;
            }

            const res = await api.post('/chatbot/message', payload);
            const { reply, suggested_capstones, faculty_list } = res.data.data;

            const botMsg = {
                id: Date.now() + 1,
                role: 'bot',
                text: reply,
                time: new Date(),
                suggestions: suggested_capstones ?? [],
                facultyList: faculty_list ?? [],
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
                facultyList: [],
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

    const handleClear = () => setMessages([]);

    if (!user) return null;

    // FAB style with dynamic position
    const fabStyle = {
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'transform 0.2s ease',
    };

    return (
        <>
            {/* ── Floating Action Button (Draggable) ──────────────────── */}
            <button
                ref={fabRef}
                id="chatbot-fab"
                className="chatbot-fab"
                style={fabStyle}
                onClick={handleFabClick}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                title="AcaBot — AI Capstone Assistant (Drag to move)"
            >
                {open ? (
                    // X icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                         style={{ width: '1.25rem', height: '1.25rem', pointerEvents: 'none' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    // Chat icon
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"
                         style={{ width: '1.35rem', height: '1.35rem', pointerEvents: 'none' }}>
                        <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                )}
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
                            <div className="chatbot-header-name">AcaBot</div>
                            <div className="chatbot-header-status">
                                <span className="chatbot-status-dot" />
                                {ROLE_SUBTITLE[currentRole] ?? 'AI Capstone Assistant'}
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



                    {/* Messages */}
                    <div className="chatbot-messages" id="chatbot-messages">
                        {messages.length === 0 ? (
                            /* ── FAQ Panel replaces old empty/chip state ── */
                            <FaqPanel
                                role={currentRole}
                                capstoneContext={capstoneContext}
                                onAsk={(q) => sendMessage(q)}
                                filter={input}
                            />
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
                                                ? renderMarkdown(msg.text, (capId, keyProp) => (
                                                    <button
                                                        key={keyProp ?? capId}
                                                        className="chatbot-inline-link"
                                                        onClick={() => {
                                                            setOpen(false);
                                                            navigate(getCapstoneRoute(capId));
                                                        }}
                                                        title="View capstone"
                                                    >
                                                        🔗 View
                                                    </button>
                                                ))
                                                : msg.text
                                            }
                                        </div>

                                        {/* Faculty selection buttons — shown when adviser flow is active */}
                                        {msg.role === 'bot' && msg.facultyList?.length > 0 && (
                                            <div className="chatbot-faculty-list">
                                                {msg.facultyList.map((faculty) => (
                                                    <button
                                                        key={faculty.id}
                                                        className="chatbot-faculty-btn"
                                                        onClick={() => sendMessage(
                                                            `Show capstones advised by ${faculty.name}`,
                                                            { selected_adviser_id: faculty.id }
                                                        )}
                                                    >
                                                        👨‍🏫 {faculty.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

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

                    {/* FAQ Drawer — slides up mid-conversation when toggled */}
                    {messages.length > 0 && showFaqDrawer && (
                        <div className="chatbot-faq-drawer">
                            <FaqPanel
                                role={currentRole}
                                capstoneContext={capstoneContext}
                                onAsk={(q) => sendMessage(q)}
                                filter={input}
                            />
                        </div>
                    )}

                    <div className="chatbot-footer">
                        {/* FAQ toggle — only visible once conversation has started */}
                        {messages.length > 0 && (
                            <button
                                className={`chatbot-faq-toggle${showFaqDrawer ? ' active' : ''}`}
                                onClick={() => setShowFaqDrawer(v => !v)}
                                title={showFaqDrawer ? 'Hide questions' : 'Browse questions'}
                            >
                                {showFaqDrawer ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                                         style={{ width: '1rem', height: '1rem' }}>
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                         style={{ width: '1rem', height: '1rem' }}>
                                        <line x1="8" y1="6" x2="21" y2="6" />
                                        <line x1="8" y1="12" x2="21" y2="12" />
                                        <line x1="8" y1="18" x2="21" y2="18" />
                                        <line x1="3" y1="6" x2="3.01" y2="6" />
                                        <line x1="3" y1="12" x2="3.01" y2="12" />
                                        <line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                )}
                            </button>
                        )}
                        <textarea
                            ref={textareaRef}
                            id="chatbot-input"
                            className="chatbot-textarea"
                            rows={1}
                            placeholder={messages.length === 0 ? 'Search questions or ask anything…' : 'Ask about capstone projects…'}
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
