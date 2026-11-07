import { createContext, useContext, useSyncExternalStore } from 'react'

export const CapstoneUploadContext = createContext(null)

export function useCapstoneUpload() {
  const manager = useContext(CapstoneUploadContext)
  if (!manager) throw new Error('useCapstoneUpload must be used within CapstoneUploadProvider')
  return { manager, ...useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot) }
}
