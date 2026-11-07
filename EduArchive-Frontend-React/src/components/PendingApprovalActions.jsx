import { HiOutlineEye, HiOutlineCheck, HiOutlineX } from 'react-icons/hi'

export default function PendingApprovalActions({ capstone, onView, onApprove, onReject }) {
  return <div className="flex items-center gap-2">
    {[
      ['View', HiOutlineEye, onView, 'text-blue-600 hover:bg-blue-50'],
      ['Approve', HiOutlineCheck, onApprove, 'text-green-700 hover:bg-green-50'],
      ['Reject', HiOutlineX, onReject, 'text-red-600 hover:bg-red-50'],
    ].map(([label, Icon, action, colors]) => <button key={label} type="button"
      onClick={() => action(capstone)} title={label} aria-label={`${label} ${capstone.title}`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${colors}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>)}
  </div>
}
