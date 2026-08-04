import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HiCheckCircle, HiXCircle, HiInformationCircle, HiX } from 'react-icons/hi';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now() + Math.random();
        setNotifications(prev => [...prev, { id, message, type }]);
        if (duration > 0) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, duration);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const notify = {
        success: (msg) => addNotification(msg, 'success'),
        error: (msg) => addNotification(msg, 'error', 6000),
        info: (msg) => addNotification(msg, 'info'),
    };

    return (
        <NotificationContext.Provider value={notify}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border text-sm animate-slide-in
                            ${n.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
                            ${n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
                            ${n.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
                        `}
                    >
                        {n.type === 'success' && <HiCheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                        {n.type === 'error' && <HiXCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                        {n.type === 'info' && <HiInformationCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
                        <span className="flex-1">{n.message}</span>
                        <button onClick={() => removeNotification(n.id)} className="shrink-0">
                            <HiX className="w-4 h-4 opacity-50 hover:opacity-100" />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}
