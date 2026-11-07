import { HiOutlineViewGrid, HiOutlineViewList } from 'react-icons/hi'

export default function LayoutSwitcher({ value, onChange }) {
  return <div className="inline-flex gap-1 rounded-lg border border-gray-200 p-1" aria-label="Layout">
    {[[ 'table', 'Table View', HiOutlineViewList ], [ 'card', 'Card View', HiOutlineViewGrid ]].map(([mode, label, Icon]) =>
      <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${value === mode ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>
        <Icon aria-hidden="true" />{label}
      </button>)}
  </div>
}
