import { createUploadCheckpointStore } from './uploadCheckpointStore'
import { resumableCapstoneTransfer } from './resumableCapstoneTransfer'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/axios'
import { getApiErrorMessage } from '../api/errors'
import { useAuth } from '../context/useAuth'
import { createCapstoneUploadManager } from './capstoneUploadManager'
import { CapstoneUploadContext } from './useCapstoneUpload'
import UploadActivity from './UploadActivity'
import { flushCitationCopies } from './citationCopyEvents'

export default function CapstoneUploadProvider({ children }) {
  const { user } = useAuth()
  const { pathname, state } = useLocation()
  const reviewUploadId = state?.uploadId || state?.pdfInfo?.upload_id
  const [manager] = useState(() => createCapstoneUploadManager({ api, errorMessage: getApiErrorMessage, persistence: createUploadCheckpointStore(), sendFile: resumableCapstoneTransfer }))
  useEffect(() => { manager.setOwner(user?.id ?? null) }, [manager, user?.id])
  useEffect(() => {
    if (!user?.id) return
    const flush = () => { void flushCitationCopies(api, user.id) }
    flush()
    const timer = setInterval(flush, 30000)
    window.addEventListener('online', flush)
    return () => { clearInterval(timer); window.removeEventListener('online', flush) }
  }, [user?.id])
  useEffect(() => {
    manager.setReviewing(Boolean(reviewUploadId && manager.getSnapshot().task?.data?.upload_id === reviewUploadId
      && /^\/(admin|faculty|student)\/capstone-library\/review-data\/?$/.test(pathname)))
  }, [manager, pathname, reviewUploadId])
  useEffect(() => () => manager.dispose(), [manager])
  return <CapstoneUploadContext.Provider value={manager}>
    {children}
    <UploadActivity />
  </CapstoneUploadContext.Provider>
}
