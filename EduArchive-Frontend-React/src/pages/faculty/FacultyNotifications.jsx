import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '../../api/admin';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import { useNotification } from '../../components/useNotification';
import { HiOutlineBell, HiOutlineCheck } from 'react-icons/hi';
import { getApiErrorMessage } from '../../api/errors';

const PAGE_SIZE = 15;

export default function FacultyNotifications() {
    const notify = useNotification();
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const load = async (targetPage = page) => {
        try {
            const res = await getNotifications({ page: targetPage, per_page: PAGE_SIZE });
            const data = res.data.data;
            setItems(Array.isArray(data) ? data : (data?.data || []));
            setPagination(Array.isArray(data) ? null : data);
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'Notifications could not be loaded.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(page); }, [page]);

    const markRead = async (notification) => {
        if (notification.is_read) return;
        try {
            await markNotificationRead(notification.id);
            setItems(prev => prev.map(item => item.id === notification.id ? { ...item, is_read: true } : item));
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'The notification could not be marked as read.'));
        }
    };

    const markAll = async () => {
        try {
            await markAllNotificationsRead();
            setItems(prev => prev.map(item => ({ ...item, is_read: true })));
            notify.success('All notifications marked as read.');
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'Notifications could not be updated.'));
        }
    };

    if (loading) return <Loading text="Loading notifications..." />;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                    <p className="text-sm text-gray-500 mt-1">Adviser submissions, upload processing, and account updates addressed to you.</p>
                </div>
                <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
                    <HiOutlineCheck className="w-4 h-4" /> Mark all read
                </button>
            </div>

            {!items.length ? (
                <EmptyState
                    icon={<HiOutlineBell className="w-6 h-6" />}
                    title="No notifications"
                    description="New adviser submissions and processing updates will appear here."
                />
            ) : (
                <>
                    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" aria-label="Notifications">
                        <ul className="divide-y divide-gray-100">
                            {items.map(notification => (
                                <li key={notification.id} className={notification.is_read ? 'bg-white' : 'bg-green-50/50'}>
                                    <button
                                        type="button"
                                        onClick={() => markRead(notification)}
                                        disabled={notification.is_read}
                                        className="w-full text-left px-5 py-4 flex gap-4 hover:bg-gray-50 transition-colors disabled:cursor-default"
                                        aria-label={notification.is_read ? notification.title : `${notification.title}, unread`}
                                    >
                                        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${notification.is_read ? 'bg-gray-200' : 'bg-green-600'}`} aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <strong className="text-sm text-gray-900">{notification.title || 'Notification'}</strong>
                                                <time className="text-xs text-gray-400" dateTime={notification.created_at}>
                                                    {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                                                </time>
                                            </span>
                                            <span className="block text-sm text-gray-600 mt-1">{notification.message}</span>
                                            {notification.related_capstone && (
                                                <Link
                                                    to={`/faculty/capstones/${notification.related_capstone.slug || notification.related_capstone.id}`}
                                                    onClick={event => event.stopPropagation()}
                                                    className="inline-block mt-2 text-xs font-semibold text-green-700 hover:underline"
                                                >
                                                    View capstone →
                                                </Link>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <Pagination paginationData={pagination} page={page} onPageChange={setPage} perPage={PAGE_SIZE} />
                </>
            )}
        </div>
    );
}
