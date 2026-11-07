import { useEffect, useState } from 'react'
import { formatElapsed } from './uploadProgress'

/**
 * Transfer-only feedback. The app tracks server processing separately, so this
 * component never implies that the modal has to stay open for OCR/AI work.
 */
export default function UploadFeedback({ transfer, startedAt }) {
  const [elapsed, setElapsed] = useState(() => startedAt ? (Date.now() - startedAt) / 1000 : 0)
  useEffect(() => {
    const started = startedAt || Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  const unknownTransfer = transfer.percent === null && transfer.loaded > 0
  const title = unknownTransfer
    ? 'Preparing your file…'
    : transfer.sent
      ? 'File sent. Confirming storage…'
      : 'Uploading file…'
  return <div className="upload-feedback">
    <div role="status" aria-live="polite" className="text-center">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {unknownTransfer
          ? 'Transfer progress is unavailable. You can review the file once it is safely stored.'
          : transfer.sent
            ? 'Waiting for AcadeX to confirm the upload. You can close this window safely.'
            : 'Sending the PDF to AcadeX.'}
      </p>
    </div>
    {!transfer.sent && transfer.percent !== null ? <progress className="upload-progress" max={100} value={transfer.percent} aria-label="File transfer" />
      : <div className="upload-progress-track" role="progressbar" aria-label={title} aria-valuetext="In progress; a completion percentage is not available"><span className="upload-indeterminate" /></div>}
    <div className="upload-progress-details">
      <span>{transfer.sent ? 'File transfer complete' : transfer.percent === null ? `${(transfer.loaded / 1048576).toFixed(1)} MiB sent` : `${transfer.percent}% sent`}</span>
      <span>{formatElapsed(elapsed)} elapsed</span>
    </div>
    {elapsed >= 45 && !transfer.sent && <p className="upload-wait-note">Still sending your document. Large PDFs need more time; uploading it again will not speed this up.</p>}
  </div>
}
