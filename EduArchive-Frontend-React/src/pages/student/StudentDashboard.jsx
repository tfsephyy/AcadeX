import { useState, useEffect } from 'react';
import { HiOutlineAcademicCap, HiOutlineBookmark, HiOutlineDocumentText, HiOutlineBookOpen } from 'react-icons/hi';
import Loading from '../../components/Loading';

export default function StudentDashboard() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalBookmarks: 0,
        recentlyViewed: 0,
        downloadedCapstones: 0,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // TODO: Replace with actual API call
            const mockStats = {
                totalBookmarks: 12,
                recentlyViewed: 24,
                downloadedCapstones: 8,
            };
            setStats(mockStats);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;

    const statCards = [
        {
            label: 'Bookmarked Capstones',
            value: stats.totalBookmarks,
            icon: HiOutlineBookmark,
            color: 'bg-blue-50',
            iconColor: 'text-blue-600',
        },
        {
            label: 'Recently Viewed',
            value: stats.recentlyViewed,
            icon: HiOutlineDocumentText,
            color: 'bg-green-50',
            iconColor: 'text-green-600',
        },
        {
            label: 'Downloaded',
            value: stats.downloadedCapstones,
            icon: HiOutlineAcademicCap,
            color: 'bg-purple-50',
            iconColor: 'text-purple-600',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-2">Welcome back! Here's your learning overview.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className={`${card.color} rounded-lg p-6 border border-gray-200`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">{card.label}</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                                </div>
                                <Icon className={`${card.iconColor} w-12 h-12 opacity-50`} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                        <HiOutlineBookOpen className="w-6 h-6 text-[#1B5E20]" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900">Browse Capstones</p>
                            <p className="text-sm text-gray-500">Explore the capstone library</p>
                        </div>
                    </button>
                    <button className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                        <HiOutlineBookmark className="w-6 h-6 text-[#1B5E20]" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900">My Bookmarks</p>
                            <p className="text-sm text-gray-500">View your saved capstones</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
