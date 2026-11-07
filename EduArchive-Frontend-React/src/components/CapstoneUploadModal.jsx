import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText } from 'react-icons/hi'
import { useCapstoneUpload } from './useCapstoneUpload'
import { useDialogFocus } from './useDialogFocus'
import { useNotification } from './useNotification'
import { validateCapstonePdf } from './pdfUploadValidation'

export default function CapstoneUploadModal({ open, onClose, role }) {
  const notify = useNotification()
  const { task, restoring, manager } = useCapstoneUpload()
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const close = () => { setFile(null); onClose() }
  const dialogRef = useDialogFocus(open && !task, close)
  useEffect(() => {
    if (open && task) { manager.expand(); onClose() }
  }, [open, task, manager, onClose])
  if (!open || task) return null

  const selectFile = event => {
    const selected = event.target.files[0]
    if (!selected) return
    const error = validateCapstonePdf(selected)
    if (error) { notify.error(error); event.target.value = ''; return }
    setFile(selected)
  }
  const upload = () => {
    if (manager.start(file, role)) close()
  }
  return createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div className="fixed inset-0 ui-dialog-backdrop" onClick={close} />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="upload-picker-title" tabIndex={-1}
      className="ui-dialog relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-green-100 bg-white shadow-2xl animate-scale-in">
      <header className="upload-heading flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <h2 id="upload-picker-title" className="text-lg font-semibold text-white">Upload Capstone PDF</h2>
          <p className="mt-0.5 text-xs text-green-200">Select a PDF file to extract metadata automatically</p>
        </div>
        <button type="button" aria-label="Close upload" onClick={close} className="rounded-lg p-2 text-green-100 hover:bg-white/20 hover:text-white"><HiOutlineX className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <div className="px-6 py-8">
        <div role="button" tabIndex={0} aria-label={file ? 'Choose a different PDF' : 'Choose a capstone PDF'}
          onClick={() => fileRef.current?.click()}
          onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); fileRef.current?.click() } }}
          className="upload-dropzone cursor-pointer rounded-xl border border-dashed border-green-300 bg-green-50/20 p-10 text-center transition-all hover:border-green-500 hover:bg-green-50/50">
          <div className="flex flex-col items-center gap-3">
            {file ? <>
              <HiOutlineDocumentText className="h-16 w-16 text-green-500" aria-hidden="true" />
              <p className="max-w-full break-all text-sm font-semibold text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1048576).toFixed(2)} MiB</p>
              <button type="button" onClick={event => { event.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-xs text-red-500 underline hover:text-red-700">Remove file</button>
            </> : <>
              <HiOutlineUpload className="h-16 w-16 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-500">Click to select PDF file</p>
              <p className="text-xs text-gray-400">PDF only · Up to 128 MiB · Saved in this browser until transfer completes</p>
            </>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={selectFile} className="hidden" />
      </div>
      <footer className="upload-footer flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button type="button" onClick={close} className="upload-secondary-button rounded-lg border px-4 py-2 text-sm font-medium">Cancel</button>
        <button type="button" onClick={upload} disabled={!file || restoring} className="inline-flex items-center gap-2 rounded-lg bg-[#1B5E20] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">
          <HiOutlineUpload className="h-4 w-4" aria-hidden="true" />Upload &amp; Extract
        </button>
      </footer>
    </section>
  </div>, document.body)
}
