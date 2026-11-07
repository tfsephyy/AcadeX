import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText, HiOutlineClock, HiCheckCircle, HiOutlineExclamationCircle, HiOutlineXCircle } from 'react-icons/hi'
import { useAuth } from '../context/useAuth'
import { useCapstoneUpload } from './useCapstoneUpload'
import { useDialogFocus } from './useDialogFocus'
import { getUploadReviewState } from './capstoneUploadManager'
import UploadFeedback from './UploadFeedback'

export default function UploadActivity() {
  const { task, expanded, manager } = useCapstoneUpload()
  const { user } = useAuth()
  const navigate = useNavigate()
  const visible = Boolean(task && task.owner === user?.id)
  const dialogRef = useDialogFocus(visible && expanded, manager.minimize)
  if (!visible) return null

  const transferring = task.phase === 'uploading'
  const working = ['queued', 'processing'].includes(task.phase)
  const dismissable = !transferring && task.phase !== 'processing'
  const cancelled = task.phase === 'cancelled'
  const complete = task.phase === 'completed'
  const failed = ['error', 'failed', 'unavailable'].includes(task.phase)
  const reviewable = Boolean(task.data?.upload_id && task.phase !== 'unavailable')
  const title = transferring ? (task.transfer.sent ? 'Confirming upload' : 'Uploading PDF')
    : task.phase === 'queued' ? 'Waiting to process'
      : task.phase === 'processing' ? 'Processing PDF'
        : complete ? 'Ready to review' : cancelled ? 'Upload cancelled' : 'Upload needs attention'
  const Icon = complete ? HiCheckCircle : cancelled ? HiOutlineXCircle : failed ? HiOutlineExclamationCircle : working ? HiOutlineClock : HiOutlineUpload
  const review = () => {
    manager.minimize()
    navigate(`/${task.role}/capstone-library/review-data`, { state: getUploadReviewState(task) })
  }

  return createPortal(expanded ? <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
    <div className="fixed inset-0 ui-dialog-backdrop" onClick={manager.minimize} />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="upload-activity-title" tabIndex={-1}
      className="ui-dialog upload-activity-dialog relative w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl animate-scale-in">
      <header className="upload-heading flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <h2 id="upload-activity-title" className="text-lg font-semibold text-white">Upload Capstone PDF</h2>
          <p className="mt-1 text-xs text-green-100">Close this window to keep browsing with the floating progress icon.</p>
        </div>
        <button type="button" onClick={manager.minimize} aria-label="Close upload progress" title="Minimize upload progress"
          className="rounded-lg p-2 text-green-100 transition-colors hover:bg-white/20 hover:text-white">
          <HiOutlineX className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="space-y-5 px-6 py-6">
        <div className="upload-activity-file flex min-w-0 items-center gap-3 rounded-xl border p-3">
          <HiOutlineDocumentText className="h-8 w-8 shrink-0 text-green-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={task.name}>{task.name}</p>
            <p className="text-xs upload-activity-muted">{(task.size / 1048576).toFixed(2)} MiB</p>
          </div>
        </div>
        {transferring ? <>
          <UploadFeedback transfer={task.transfer} startedAt={task.startedAt} />
          <p className="text-xs upload-activity-muted">Upload recovery is saved in this browser. Reloading reconnects and resumes from the last confirmed chunk.</p>
        </> : <div className="space-y-3" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon className={`h-5 w-5 shrink-0 ${failed ? 'text-red-500' : 'text-green-600'}`} aria-hidden="true" />
            {title}
          </div>
          {working && <div className="upload-progress-track" role="progressbar" aria-label={title} aria-valuetext="Processing; a completion percentage is not available"><span className="upload-indeterminate" /></div>}
          <p className="text-sm upload-activity-muted">
            {working ? 'Your PDF is saved. Metadata extraction continues even if you reload or close this page; return to review the details when it is ready.'
              : complete ? 'Your PDF is uploaded and processing has finished. Review the extracted details to continue your submission.'
                : cancelled ? (task.transfer.sent
                  ? 'The upload request was cancelled. Your file was already sent, so the server may finish processing it.'
                  : 'The upload request was cancelled. You can upload the PDF again when you are ready.')
                  : task.error || 'Review this upload or try sending your PDF again.'}
          </p>
          {task.connectionError && <p className="text-xs upload-activity-muted">{task.connectionError}</p>}
        </div>}
      </div>
      <footer className="upload-footer flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
        {transferring && <button type="button" onClick={manager.cancel}
          title={task.transfer.sent ? 'Cancel waiting for confirmation; the server may already have received the file.' : 'Stop sending this PDF'}
          className="upload-cancel-button mr-auto inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium">
          <HiOutlineXCircle className="h-4 w-4" aria-hidden="true" /> Cancel upload
        </button>}
        {dismissable && <button type="button" onClick={manager.dismiss} className="upload-secondary-button mr-auto rounded-lg border px-4 py-2 text-sm font-medium">Dismiss</button>}
        {['error', 'cancelled'].includes(task.phase) && <button type="button" onClick={manager.retry} className="upload-secondary-button rounded-lg border px-4 py-2 text-sm font-medium">Resume upload</button>}
        <button type="button" onClick={manager.minimize} className="upload-secondary-button rounded-lg border px-4 py-2 text-sm font-medium">Close</button>
        {reviewable && <button type="button" onClick={review} className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Review details</button>}
      </footer>
    </section>
  </div> : <button type="button" onClick={manager.expand} className="upload-floating-control"
    aria-label={`${title}${transferring && task.transfer.percent !== null ? `, ${task.transfer.percent}% sent` : ''}. Open upload progress`}
    title="Open upload progress" aria-haspopup="dialog">
    <span className="upload-floating-icon"><Icon className="h-6 w-6" aria-hidden="true" /></span>
    <span className="min-w-0 text-left">
      <span className="block text-xs font-semibold">{title}</span>
      <span className="upload-activity-muted block max-w-36 truncate text-xs">{task.name}</span>
    </span>
    {transferring && <span className="text-xs font-bold tabular-nums">{task.transfer.percent === null ? '…' : `${task.transfer.percent}%`}</span>}
  </button>, document.body)
}
