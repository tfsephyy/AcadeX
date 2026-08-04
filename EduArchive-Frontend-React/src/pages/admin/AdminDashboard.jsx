import { useState, useEffect } from 'react';
import { HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineDocumentAdd } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getDashboardStats, getUploadedByYear, getStudentsPerYear, getRecentApproved } from '../../api/admin';
import Loading from '../../components/Loading';
import CapstoneModal from '../../components/admin/CapstoneModal';

// Colors for students year level donut chart
const YEAR_COLORS = {
    '1': '#FFB84D',   // Amber
    '2': '#66BB6A',   // Green
    '3': '#42A5F5',   // Blue  
    '4': '#EC407A',   // Pink
};

// Get color for year
const getYearColor = (year) => YEAR_COLORS[String(year)] || '#9E9E9E';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [uploadedByYear, setUploadedByYear] = useState([]);
    const [studentsPerYear, setStudentsPerYear] = useState([]);
    const [recentApproved, setRecentApproved] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCapstone, setSelectedCapstone] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, uploadRes, studRes, recentRes] = await Promise.all([
                getDashboardStats(),
                getUploadedByYear(),
                getStudentsPerYear(),
                getRecentApproved(),
            ]);
            setStats(statsRes.data.data);
            setUploadedByYear(uploadRes.data.data || []);
            setStudentsPerYear(studRes.data.data || []);
            setRecentApproved(recentRes.data.data || []);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading text="Loading dashboard..." />;

    // Calculate total students for donut center
    const totalStudents = studentsPerYear.reduce((sum, d) => sum + (d.count || 0), 0);

    // Stat cards - 3 cards: Students, Faculty, Uploaded
    const statCards = [
        { 
            label: 'Students', 
            value: stats?.students ?? 0, 
            icon: HiOutlineAcademicCap, 
            color: 'text-blue-600', 
            bg: 'bg-blue-50' 
        },
        { 
            label: 'Faculty', 
            value: stats?.faculty ?? 0, 
            icon: HiOutlineUserGroup, 
            color: 'text-purple-600', 
            bg: 'bg-purple-50' 
        },
        { 
            label: 'Uploaded', 
            value: stats?.uploaded ?? 0, 
            icon: HiOutlineDocumentAdd, 
            color: 'text-green-600', 
            bg: 'bg-green-50' 
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Overview of the EduArchive system</p>
            </div>

            {/* Main Layout: Cards on left, Graphs on right */}
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                {/* Left: Stat Cards - Vertical stack, centered */}
                <div className="flex flex-col gap-3 lg:w-1/4">
                    {statCards.map((card) => (
                        <div 
                            key={card.label} 
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500">{card.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                                </div>
                                <div className={`p-2 rounded-lg ${card.bg}`}>
                                    <card.icon className={`w-5 h-5 ${card.color}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: Charts side by side - Bar Graph on left, Doughnut on right */}
                <div className="flex flex-col lg:flex-row gap-4 lg:w-3/4">
                    {/* Bar Graph - Uploaded Capstone by Year */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex-1">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Uploaded Capstones by Year</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[...uploadedByYear].reverse()}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            borderRadius: '8px', 
                                            fontSize: '12px',
                                            border: '1px solid #e5e7eb'
                                        }} 
                                    />
                                    <Bar dataKey="count" fill="#8BC34A" radius={[6, 6, 0, 0]} name="Capstones" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Doughnut Graph - Students per Year Level */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex-1">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Students per Year Level</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={studentsPerYear}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="35%"
                                        outerRadius="75%"
                                        paddingAngle={2}
                                        dataKey="count"
                                        nameKey="year"
                                        stroke="none"
                                    >
                                        {studentsPerYear.map((entry, idx) => (
                                            <Cell key={`cell-${idx}`} fill={getYearColor(entry.year)} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ 
                                            borderRadius: '8px', 
                                            fontSize: '12px',
                                            border: '1px solid #e5e7eb'
                                        }}
                                        formatter={(value, name) => {
                                            if (name === 'year') {
                                                return [`Year ${value}`, 'Level'];
                                            }
                                            return [value, 'Students'];
                                        }}
                                        labelFormatter={() => ''}
                                    />
                                    <Legend 
                                        layout="vertical" 
                                        align="right" 
                                        verticalAlign="middle"
                                        formatter={(value, entry) => `Year ${entry.payload.year}`}
                                        wrapperStyle={{ fontSize: '12px', paddingLeft: '0.5rem' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Capstone Uploaded - Simplified table */}
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
                                    <tr
                                        key={cap.id}
                                        onClick={() => setSelectedCapstone(cap)}
                                        className="border-b border-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors"
                                    >
                                        <td className="py-3 px-4 font-medium text-gray-700 max-w-lg truncate">{cap.title}</td>
                                        <td className="py-3 px-4 text-gray-500">{cap.year || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Capstone Modal */}
            <CapstoneModal
                capstone={selectedCapstone}
                open={!!selectedCapstone}
                onClose={() => setSelectedCapstone(null)}
            />
        </div>
    );
}
