import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineDocumentAdd, HiOutlineEye, HiOutlineBookOpen, HiOutlineGlobe, HiOutlineShieldCheck, HiOutlineShare } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import {
    getDashboardStats, getUploadedByYear, getStudentsPerYear,
    getRecentApproved, getMostViewed, getMostCited,
    getCopyrightedCapstones, getPublishedCapstonesCount, getPlatformActivity,
} from '../../api/admin';
import Loading from '../../components/Loading';
import CapstoneModal from '../../components/admin/CapstoneModal';

// Colors for students year level donut chart
const YEAR_COLORS = {
    '1': '#FFB84D',
    '2': '#66BB6A',
    '3': '#42A5F5',
    '4': '#EC407A',
};
const getYearColor = (year) => YEAR_COLORS[String(year)] || '#9E9E9E';

/* ── Rank Badge ─────────────────────────────────────────────── */
function RankBadge({ rank }) {
    const styles = {
        1: 'bg-yellow-400 text-yellow-900',
        2: 'bg-gray-300 text-gray-700',
        3: 'bg-orange-300 text-orange-800',
    };
    return (
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${styles[rank] || 'bg-gray-100 text-gray-500'}`}>
            {rank}
        </span>
    );
}

/* ── Horizontal bar metric ──────────────────────────────────── */
function MetricBar({ value, max, color }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [uploadedByYear, setUploadedByYear] = useState([]);
    const [studentsPerYear, setStudentsPerYear] = useState([]);
    const [recentApproved, setRecentApproved] = useState([]);
    const [mostViewed, setMostViewed] = useState([]);
    const [mostCited, setMostCited] = useState([]);
    const [copyrightedCount, setCopyrightedCount] = useState(0);
    const [publishedCount, setPublishedCount] = useState(0);
    const [platformActivity, setPlatformActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCapstone, setSelectedCapstone] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const results = await Promise.allSettled([
                getDashboardStats(),
                getUploadedByYear(),
                getStudentsPerYear(),
                getRecentApproved(),
                getMostViewed(),
                getMostCited(),
                getCopyrightedCapstones(),
                getPublishedCapstonesCount(),
                getPlatformActivity(),
            ]);

            const get = (i, fallback) =>
                results[i].status === 'fulfilled' ? results[i].value.data.data : fallback;

            setStats(get(0, {}));
            setUploadedByYear(get(1, []) || []);
            setStudentsPerYear(get(2, []) || []);
            setRecentApproved(get(3, []) || []);
            setMostViewed(get(4, []) || []);
            setMostCited(get(5, []) || []);
            setCopyrightedCount(get(6, { count: 0 })?.count ?? 0);
            setPublishedCount(get(7, { count: 0 })?.count ?? 0);
            setPlatformActivity(get(8, []) || []);

            // Log any individual failures for debugging
            results.forEach((r, i) => {
                if (r.status === 'rejected') console.warn(`Dashboard request [${i}] failed:`, r.reason);
            });
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading text="Loading dashboard..." />;

    const totalStudents = studentsPerYear.reduce((sum, d) => sum + (d.count || 0), 0);
    const maxViews = mostViewed[0]?.unique_views || 1;
    const maxCitations = mostCited[0]?.citation_count || 1;

    const statCards = [
        { label: 'Students',             value: stats?.students  ?? 0, icon: HiOutlineAcademicCap,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
        { label: 'Faculty',              value: stats?.faculty   ?? 0, icon: HiOutlineUserGroup,    color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Visitors',             value: stats?.visitors  ?? 0, icon: HiOutlineGlobe,        color: 'text-teal-600',   bg: 'bg-teal-50'   },
        { label: 'Uploaded',             value: stats?.uploaded  ?? 0, icon: HiOutlineDocumentAdd,  color: 'text-green-600',  bg: 'bg-green-50'  },
        { label: 'Copyrighted Capstone', value: copyrightedCount,       icon: HiOutlineShieldCheck,  color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Published Capstone',   value: publishedCount,         icon: HiOutlineShare,        color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Overview of the EduArchive system</p>
            </div>

            {/* ── Stat Cards — full width single row ─────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {statCards.map((card) => (
                    <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-500 truncate">{card.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                            </div>
                            <div className={`p-2 rounded-lg flex-shrink-0 ml-2 ${card.bg}`}>
                                <card.icon className={`w-5 h-5 ${card.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts row: Bar + Pie + Line ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Bar Graph */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Uploaded Capstones by Year</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...uploadedByYear].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
                                <Bar dataKey="count" fill="#8BC34A" radius={[6, 6, 0, 0]} name="Capstones" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Doughnut */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Students per Year Level</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={studentsPerYear} cx="50%" cy="50%" innerRadius="35%" outerRadius="75%"
                                    paddingAngle={2} dataKey="count" nameKey="year" stroke="none">
                                    {studentsPerYear.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={getYearColor(entry.year)} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e5e7eb' }}
                                    formatter={(value, name) => name === 'year' ? [`Year ${value}`, 'Level'] : [value, 'Students']}
                                    labelFormatter={() => ''} />
                                <Legend layout="vertical" align="right" verticalAlign="middle"
                                    formatter={(value, entry) => `Year ${entry.payload.year}`}
                                    wrapperStyle={{ fontSize: '12px', paddingLeft: '0.5rem' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Line Chart — Platform Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700">Platform Activity</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-blue-500" />Users</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-orange-400" />Views</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-green-500" />Uploads</span>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={platformActivity} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}
                                    formatter={(value, name) => {
                                        const labels = { users: 'New Users', views: 'Capstone Views', uploads: 'Uploads' };
                                        return [value, labels[name] || name];
                                    }}
                                />
                                <Line type="monotone" dataKey="users"   stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="views"   stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="uploads" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Most Viewed + Most Cited ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Most Viewed */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                            <HiOutlineEye className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700">Most Viewed Capstones</h3>
                            <p className="text-xs text-gray-400">Unique views per account</p>
                        </div>
                    </div>

                    {mostViewed.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No view data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {mostViewed.map((cap, idx) => (
                                <div key={cap.id}
                                    onClick={() => setSelectedCapstone(cap)}
                                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors group">
                                    <RankBadge rank={idx + 1} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700 transition-colors">{cap.title}</p>
                                        <p className="text-xs text-gray-400 truncate">{cap.author}{cap.year ? ` · ${cap.year}` : ''}{cap.program ? ` · ${cap.program}` : ''}</p>
                                        <MetricBar value={cap.unique_views} max={maxViews} color="#3b82f6" />
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className="text-sm font-bold text-blue-600">{cap.unique_views}</span>
                                        <p className="text-xs text-gray-400">views</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Most Cited */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                            <HiOutlineBookOpen className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700">Most Cited Capstones</h3>
                            <p className="text-xs text-gray-400">Referenced by other capstones</p>
                        </div>
                    </div>

                    {mostCited.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No citation data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {mostCited.map((cap, idx) => (
                                <div key={cap.id}
                                    onClick={() => setSelectedCapstone(cap)}
                                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-purple-50/50 cursor-pointer transition-colors group">
                                    <RankBadge rank={idx + 1} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-purple-700 transition-colors">{cap.title}</p>
                                        <p className="text-xs text-gray-400 truncate">{cap.author}{cap.year ? ` · ${cap.year}` : ''}{cap.program ? ` · ${cap.program}` : ''}</p>
                                        <MetricBar value={cap.citation_count} max={maxCitations} color="#8b5cf6" />
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className="text-sm font-bold text-purple-600">{cap.citation_count}</span>
                                        <p className="text-xs text-gray-400">citations</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Capstones */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Capstones Uploaded</h3>
                {recentApproved.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No capstones uploaded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Title</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Year</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentApproved.map((cap) => (
                                    <tr key={cap.id} onClick={() => setSelectedCapstone(cap)}
                                        className="border-b border-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors">
                                        <td className="py-3 px-4 font-medium text-gray-700 max-w-lg truncate">{cap.title}</td>
                                        <td className="py-3 px-4 text-gray-500">{cap.year || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CapstoneModal
                capstone={selectedCapstone}
                open={!!selectedCapstone}
                onClose={() => setSelectedCapstone(null)}
            />
        </div>
    );
}
