import { useEffect, useState } from 'react'
import { formatElapsed } from './uploadProgress'

export default function UploadFeedback({ transfer, manual, extractionRequested }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000)
    return () => clearInterval(timer)
  }, [])
  const unknownTransfer = transfer.percent === null && transfer.loaded > 0
  const title = unknownTransfer ? 'Preparing your file…' : !transfer.sent ? 'Uploading file…' : extractionRequested ? 'Reading your document…' : 'Saving your file securely…'
  return <div className="upload-feedback">
    <div role="status" aria-live="polite" className="text-center">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {unknownTransfer ? 'Transfer progress is unavailable. The review form will open when file preparation finishes.' : !transfer.sent ? 'Sending the PDF to AcadeX.' : manual && extractionRequested ? 'Manual entry selected. Finishing the current file preparation.' : extractionRequested ? 'File sent. Scanned pages can take longer to read; keep this window open.' : 'Automatic extraction was skipped. Preparing the review form.'}
      </p>
    </div>
    {!transfer.sent && transfer.percent !== null ? <progress className="upload-progress" max={100} value={transfer.percent} aria-label="File transfer" />
      : <div className="upload-progress-track" role="progressbar" aria-label={title} aria-valuetext="In progress; a completion percentage is not available"><span className="upload-indeterminate" /></div>}
    <div className="upload-progress-details">
      <span>{transfer.sent ? 'File transfer complete' : transfer.percent === null ? `${(transfer.loaded / 1048576).toFixed(1)} MiB sent` : `${transfer.percent}% sent`}</span>
      <span>{formatElapsed(elapsed)} elapsed</span>
    </div>
    {elapsed >= 45 && <p className="upload-wait-note">Still preparing your document. Large or scanned PDFs need more time; uploading it again will not speed this up.</p>}
  </div>
}
