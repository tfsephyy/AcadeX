import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from 'react-icons/hi'

export default function CategoryVisibilityToggle({ expanded, onToggle, panelId = 'library-categories' }) {
  const label = expanded ? 'Hide categories' : 'Show categories'
  const Icon = expanded ? HiOutlineChevronDoubleLeft : HiOutlineChevronDoubleRight
  return <div className="inline-flex items-center gap-2">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Category</h2>
    <button type="button" onClick={onToggle} aria-label={label} title={label}
      aria-expanded={expanded} aria-controls={panelId}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
}
