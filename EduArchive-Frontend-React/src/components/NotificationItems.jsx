import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HiChevronDown } from 'react-icons/hi'
import { capstoneUrl } from '../utils/capstoneUrl'

export default function NotificationItems({ items, role, onRead, onNavigate }) {
  const [expandedId, setExpandedId] = useState(null)
  return <ul className="panel-notif-divide notification-items">
    {items.map(item => {
      const expanded = expandedId === item.id
      return <li key={item.id} className={item.is_read ? 'panel-notif-read' : 'panel-notif-unread'}>
        <button type="button" aria-expanded={expanded} onClick={() => {
          setExpandedId(expanded ? null : item.id)
          if (!item.is_read) onRead(item.id)
        }} className="notification-trigger w-full text-left px-4 py-3 flex items-start gap-3">
          <span className="notification-dot w-2 h-2 mt-1.5 rounded-full shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="notification-title block text-sm">{item.title || 'Notification'}{!item.is_read && <span className="sr-only">, unread</span>}</span>
            <span className={`notification-message block text-xs mt-1 ${expanded ? '' : 'line-clamp-2'}`}>{item.message}</span>
            {item.created_at && <time className="notification-time block text-[11px] mt-1.5" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>}
          </span>
          <HiChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && <div className="px-4 pb-3 pl-9 text-xs notification-message space-y-2">
          {item.data && <dl className="space-y-1">{Object.entries(item.data).map(([key, value]) =>
            <div key={key} className="flex flex-wrap gap-x-2"><dt className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</dd></div>
          )}</dl>}
          {item.related_capstone && <Link className="notification-link inline-block font-semibold underline" to={capstoneUrl(role, item.related_capstone)} onClick={onNavigate}>View capstone</Link>}
        </div>}
      </li>
    })}
  </ul>
}
