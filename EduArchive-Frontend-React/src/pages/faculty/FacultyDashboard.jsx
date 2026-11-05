import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    HiOutlineAcademicCap,
    HiOutlineBookOpen,
    HiOutlineClipboardCheck,
    HiOutlineClock,
    HiOutlineDocumentAdd,
    HiOutlineEye,
} from 'react-icons/hi';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getFacultyDashboard } from '../../api/admin';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

function capstoneLink(capstone) {
    return `/faculty/capstones/${capstone.slug || capstone.id}`;
}

export default function FacultyDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getFacultyDashboard()
            .then(res => { if (!cancelled) setData(res.data.data); })
            .catch(() => { if (!cancelled) setData({ assigned: {}, repository: {}, trends: { months: [] } }); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    if (loading) return <Loading text="Loading your adviser dashboard..." />;

    const assigned = data?.assigned || {};
    const repository = data?.repository || {};
    const trends = data?.trends?.months || [];
    const stats = [
        { label: 'Assigned capstones', value: assigned.total ?? 0, icon: HiOutlineClipboardCheck, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Pending review', value: assigned.pending ?? 0, icon: HiOutlineClock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Approved', value: assigned.approved ?? 0, icon: HiOutlineAcademicCap, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Views on assigned work', value: (assigned.most_viewed || []).reduce((sum, item) => sum + (item.unique_views || 0), 0), icon: HiOutlineEye, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Adviser Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Numbers below are limited to capstones where you are the assigned adviser.</p>
            </div>

            <section aria-label="Assigned capstone statistics" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {stats.map(card => (
                    <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-500">{card.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                            </div>
                            <div className={`p-2 rounded-lg flex-shrink-0 ${card.bg}`}>
                                <card.icon className={`w-5 h-5 ${card.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            <section aria-label="Six month adviser activity trends" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700">Assigned upload and view trends</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 6 months · only your assigned submissions</p>
                <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
                            <Bar dataKey="uploads" fill="#22c55e" radius={[6, 6, 0, 0]} name="Assigned uploads" />
                            <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} name="Assigned views" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h2 className="text-sm font-semibold text-gray-700">Most-viewed assigned capstones</h2>
                    {!(assigned.most_viewed || []).length ? (
                        <p className="text-sm text-gray-400 text-center py-8">No view data for your assigned capstones yet.</p>
                    ) : (
                        <div className="space-y-3 mt-4">
                            {assigned.most_viewed.map(item => (
                                <Link key={item.id} to={capstoneLink(item)} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-blue-50/50 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                                        <p className="text-xs text-gray-400">{item.author}{item.year ? ` · ${item.year}` : ''}</p>
                                    </div>
                                    <p className="text-sm font-bold text-blue-600 whitespace-nowrap">{item.unique_views} views</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h2 className="text-sm font-semibold text-gray-700">Most citation generations</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Generated with the AcadeX citation tool · not external citation data</p>
                    {!(assigned.most_cited || []).length ? (
                        <p className="text-sm text-gray-400 text-center py-8">No citation generations for your assigned capstones yet.</p>
                    ) : (
                        <div className="space-y-3 mt-4">
                            {assigned.most_cited.map(item => (
                                <Link key={item.id} to={capstoneLink(item)} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-purple-50/50 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                                        <p className="text-xs text-gray-400">{item.author}{item.year ? ` · ${item.year}` : ''}</p>
                                    </div>
                                    <p className="text-sm font-bold text-purple-600 whitespace-nowrap">{item.citation_generations} generations</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-700">Recent assigned submissions</h2>
                    <Link to="/faculty/assigned" className="text-xs font-semibold text-green-700 hover:underline">View all assigned</Link>
                </div>
                {!(assigned.recent || []).length ? (
                    <EmptyState
                        icon={<HiOutlineDocumentAdd className="w-6 h-6" />}
                        title="No assigned submissions yet"
                        description="When a student selects you as adviser, their submission will appear here."
                        action={<Link to="/faculty/approvals" className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg text-white">View pending approvals</Link>}
                    />
                ) : (
                    <div className="table-scroll overflow-x-auto mt-4" role="region" aria-label="Scrollable assigned capstone table" tabIndex={0}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Title</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Uploaded by</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assigned.recent.map(item => (
                                    <tr key={item.id} className="border-b border-gray-50 hover:bg-green-50/50">
                                        <td className="py-3 px-4 max-w-lg truncate">
                                            <Link to={capstoneLink(item)} className="font-medium text-gray-700 hover:text-green-700">{item.title}</Link>
                                        </td>
                                        <td className="py-3 px-4 text-gray-500">{item.uploader?.name || '—'}</td>
                                        <td className="py-3 px-4 text-gray-500 capitalize">{item.approval_status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section aria-label="Repository-wide statistics" className="rounded-xl border border-dashed border-gray-200 p-5 bg-gray-50/60">
                <h2 className="text-sm font-semibold text-gray-600">Repository-wide</h2>
                <p className="text-xs text-gray-400 mt-0.5">Shown separately so assigned and all-repository numbers cannot be confused.</p>
                <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-600">
                    <span><strong className="text-gray-900">{repository.total ?? 0}</strong> total capstones</span>
                    <span><strong className="text-gray-900">{repository.approved ?? 0}</strong> approved capstones</span>
                </div>
            </section>
        </div>
    );
}
