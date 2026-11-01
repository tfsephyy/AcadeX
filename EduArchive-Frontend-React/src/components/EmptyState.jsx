export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="empty-state flex flex-col items-center justify-center text-center" role="status">
            {icon && <div className="text-gray-300 mb-4">{icon}</div>}
            <h3 className="text-lg font-medium text-gray-500">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-400 max-w-sm">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
