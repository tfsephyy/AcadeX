import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { getApiErrorMessage } from '../api/errors'
import { useNotification } from './useNotification'
import { getUploadProgress } from './uploadProgress'

/**
 * Transfers one PDF, then opens the review page immediately.
 *
 * Metadata extraction runs in a queued server job. The review page polls the
 * stable upload reference, so closing this modal or navigating away never
 * cancels processing and never causes a second upload of the same file.
 */
export function useCapstoneUpload(role, onComplete) {
  const navigate = useNavigate()
  const notify = useNotification()
  const request = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [transfer, setTransfer] = useState(() => getUploadProgress())

  useEffect(() => () => request.current?.abort(), [])

  const startUpload = async (file) => {
    if (request.current) return
    if (!file) { notify.error('Please select a PDF file.'); return }

    const controller = new AbortController()
    request.current = controller
    setTransfer(getUploadProgress())
    setUploading(true)

    const form = new FormData()
    form.append('pdf', file)

    try {
      const res = await api.post(`/${role}/capstones/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: event => setTransfer(getUploadProgress(event)),
      })
      const data = res.data.data || {}
      setUploading(false)
      request.current = null
      onComplete()

      navigate(`/${role}/capstone-library/review-data`, { state: {
        pdfInfo: {
          pdf_path: data.pdf_path,
          pdf_original_name: data.pdf_original_name,
          upload_id: data.upload_id,
        },
        uploadId: data.upload_id,
        extracted: data.extracted || {},
        extractionStatus: data.extraction_status || data.processing_status || 'queued',
        extractionScope: data.extraction_scope,
        processingStatus: data.processing_status || 'queued',
        processingError: data.processing_error || '',
        retryable: Boolean(data.retryable),
        skipped: false,
      } })
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') notify.error(getApiErrorMessage(error, 'Upload failed. Please try again.'))
      setUploading(false)
      request.current = null
    }
  }

  return { uploading, transfer, startUpload }
}
