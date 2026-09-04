import { useState, useEffect } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip,
} from 'recharts';
import {
    HiEye, HiDownload, HiBookmark, HiTrendingUp, HiChartBar,
    HiUserGroup, HiLightningBolt, HiCalendar, HiChevronDown,
} from 'react-icons/hi';
import { getCapstoneAnalytics } from '../api/admin';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateFull(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent, sub }) {
    return (
        <div
            className="flex flex-col gap-1 p-3 rounded-xl border"
            style={{
                background: `${accent}0f`,
                borderColor: `${accent}30`,
            }}
        >
            <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
                    {label}
                </span>
            </div>
            <span className="text-xl font-bold leading-none" style={{ color: 'var(--color-text, #111)' }}>
                {value}
            </span>
            {sub && (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted, #888)' }}>
                    {sub}
                </span>
            )}
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="rounded-xl border shadow-lg p-3 text-xs space-y-1"
            style={{
                background: 'var(--color-surface-elevated, #fff)',
                borderColor: 'var(--color-border-strong, #e5e7eb)',
                color: 'var(--color-text, #111)',
            }}
        >
            <p className="font-semibold mb-1.5">{fmtDate(label)}</p>
            {payload.map((p) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        {p.name}
                    </span>
                    <span className="font-bold">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * CapstoneAnalyticsPanel
 *
 * Props:
 *   capstoneId  – number  (required)
 *   compact     – boolean – simplified layout for student view (no chart)
 */
export default function CapstoneAnalyticsPanel({ capstoneId, compact = false }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeLines, setActiveLines] = useState({ views: true, downloads: true, bookmarks: true });

    // Lazy-load: only fetch when panel is first opened
    useEffect(() => {
        if (!open || data || loading) return;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getCapstoneAnalytics(capstoneId);
                setData(res.data.data);
            } catch {
                setError('Could not load analytics.');
            } finally {
                setLoading(false);
            }
        })();
    }, [open, capstoneId]);

    const s = data?.summary;
    const trend = data?.trend ?? [];

    const chartData = trend.map(d => ({ ...d, label: d.date }));

    const toggleLine = (key) =>
        setActiveLines(prev => ({ ...prev, [key]: !prev[key] }));

    const lineConfig = [
        { key: 'views',     name: 'Views',     color: '#16a34a' },
        { key: 'downloads', name: 'Downloads', color: '#2563eb' },
        { key: 'bookmarks', name: 'Bookmarks', color: '#d97706' },
    ];

    return (
        <div
            className="rounded-xl border overflow-hidden"
            style={{
                background: 'var(--color-surface, #fff)',
                borderColor: 'var(--color-border, #e5e7eb)',
            }}
        >
            {/* Header / Toggle */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                style={{
                    background: open
                        ? 'var(--color-bg-tertiary, #f3f4f6)'
                        : 'var(--color-bg-secondary, #f9fafb)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-tertiary, #f3f4f6)')}
                onMouseLeave={e => (e.currentTarget.style.background = open ? 'var(--color-bg-tertiary, #f3f4f6)' : 'var(--color-bg-secondary, #f9fafb)')}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(22,163,74,0.15)' }}
                    >
                        <HiChartBar className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text, #111)' }}>
                        Analytics
                    </span>
                    {!open && s && (
                        <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                        >
                            {s.total_views} views · {s.total_downloads} downloads
                        </span>
                    )}
                </div>
                <HiChevronDown
                    className="w-4 h-4 transition-transform duration-200"
                    style={{
                        color: 'var(--color-text-muted, #6b7280)',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </button>

            {/* Body */}
            {open && (
                <div className="p-4 space-y-4">
                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-6">
                            <span
                                className="w-5 h-5 rounded-full border-2 animate-spin"
                                style={{ borderColor: '#16a34a', borderTopColor: 'transparent' }}
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-muted, #6b7280)' }}>
                                Loading analytics…
                            </span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-xs text-center py-4" style={{ color: '#ef4444' }}>{error}</p>
                    )}

                    {/* Data */}
                    {data && !loading && (
                        <>
                            {/* Summary Cards */}
                            <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                                <StatCard icon={HiEye}          label="Total Views"     value={s.total_views.toLocaleString()}     accent="#16a34a" sub="All-time" />
                                <StatCard icon={HiDownload}     label="Downloads"       value={s.total_downloads.toLocaleString()} accent="#2563eb" sub="All-time" />
                                <StatCard icon={HiBookmark}     label="Bookmarks"       value={s.total_bookmarks.toLocaleString()} accent="#d97706" sub="All-time" />
                                <StatCard icon={HiUserGroup}    label="Unique Viewers"  value={s.unique_viewers.toLocaleString()}  accent="#7c3aed" sub="Registered users" />
                                <StatCard icon={HiLightningBolt} label="Engagement"     value={`${s.engagement_rate}%`}            accent="#0891b2" sub="Download / view ratio" />
                                <StatCard
                                    icon={HiCalendar}
                                    label="Peak Day"
                                    value={s.peak_day ? `${s.peak_day.views} views` : '—'}
                                    accent="#be185d"
                                    sub={s.peak_day ? fmtDateFull(s.peak_day.date) : 'No data yet'}
                                />
                            </div>

                            {/* Trend Chart — hidden in compact (student) mode */}
                            {!compact && (
                                <div>
                                    {/* Chart label + legend toggles */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <span
                                            className="text-[10px] font-semibold uppercase tracking-wide"
                                            style={{ color: 'var(--color-text-muted, #6b7280)' }}
                                        >
                                            Last 30 days
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {lineConfig.map(({ key, name, color }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => toggleLine(key)}
                                                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all"
                                                    style={{
                                                        borderColor: activeLines[key] ? color : 'var(--color-border, #e5e7eb)',
                                                        background:  activeLines[key] ? `${color}18` : 'transparent',
                                                        color:       activeLines[key] ? color : 'var(--color-text-muted, #6b7280)',
                                                    }}
                                                >
                                                    <span
                                                        className="w-1.5 h-1.5 rounded-full"
                                                        style={{ background: activeLines[key] ? color : '#d1d5db' }}
                                                    />
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="var(--color-border, #e5e7eb)"
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="label"
                                                tickFormatter={fmtDate}
                                                tick={{ fontSize: 9, fill: 'var(--color-text-muted, #9ca3af)' }}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={6}
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                tick={{ fontSize: 9, fill: 'var(--color-text-muted, #9ca3af)' }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={28}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            {lineConfig.map(({ key, name, color }) =>
                                                activeLines[key] ? (
                                                    <Line
                                                        key={key}
                                                        type="monotone"
                                                        dataKey={key}
                                                        name={name}
                                                        stroke={color}
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                                    />
                                                ) : null
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>

                                    <p
                                        className="text-[9px] text-center mt-1 flex items-center justify-center gap-0.5"
                                        style={{ color: 'var(--color-text-muted, #9ca3af)' }}
                                    >
                                        <HiTrendingUp className="w-3 h-3" />
                                        Activity trend over the last 30 days
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
