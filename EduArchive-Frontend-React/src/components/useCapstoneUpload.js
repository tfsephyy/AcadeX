import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { getApiErrorMessage } from '../api/errors'
import { useNotification } from './useNotification'
import { getUploadProgress } from './uploadProgress'

/** One request per file. Choosing manual entry during processing never re-uploads it. */
export function useCapstoneUpload(role, onComplete) {
  const navigate = useNavigate()
  const notify = useNotification()
  const request = useRef(null)
  const manualChoice = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [manual, setManual] = useState(false)
  const [extractionRequested, setExtractionRequested] = useState(true)
  const [transfer, setTransfer] = useState(() => getUploadProgress())
  useEffect(() => () => request.current?.abort(), [])
  const chooseManual = () => { manualChoice.current = true; setManual(true) }
  const startUpload = async (file, skipExtraction = false) => {
    if (request.current) return
    if (!file) { notify.error('Please select a PDF file.'); return }
    const controller = new AbortController()
    request.current = controller
    manualChoice.current = skipExtraction
    setManual(skipExtraction)
    setExtractionRequested(!skipExtraction)
    setTransfer(getUploadProgress())
    setUploading(true)
    const form = new FormData()
    form.append('pdf', file)
    if (skipExtraction) form.append('skip_extraction', '1')
    try {
      const res = await api.post(`/${role}/capstones/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: event => setTransfer(getUploadProgress(event)),
      })
      const data = res.data.data
      const skipped = manualChoice.current
      setUploading(false)
      request.current = null
      onComplete()
      navigate(`/${role}/capstone-library/review-data`, { state: {
        pdfInfo: { pdf_path: data.pdf_path, pdf_original_name: data.pdf_original_name },
        extracted: skipped ? {} : data.extracted || {},
        extractionStatus: data.extraction_status,
        extractionScope: data.extraction_scope,
        skipped,
      } })
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') notify.error(getApiErrorMessage(error, 'Upload failed. Please try again.'))
      setUploading(false)
      request.current = null
    }
  }
  return { uploading, manual, extractionRequested, transfer, chooseManual, startUpload }
}
