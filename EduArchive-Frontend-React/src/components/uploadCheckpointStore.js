// Private, account-scoped upload recovery. Files are removed after transfer or dismissal.
export function createUploadCheckpointStore(indexedDB = globalThis.indexedDB) {
  let database
  const open = () => database ??= new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Enable site storage to resume uploads after reloading.')); return }
    const request = indexedDB.open('acadex-upload-recovery-v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('tasks')
      request.result.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = null; reject(new Error('Upload recovery storage is unavailable. Enable site storage and try again.')) }
  })
  const transaction = async (stores, mode, work) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode)
      let result
      tx.oncomplete = () => resolve(result)
      tx.onerror = tx.onabort = () => reject(new Error('Could not save upload recovery data. Check available browser storage.'))
      work(tx, value => { result = value })
    })
  }
  return {
    load: owner => transaction(['tasks', 'files'], 'readonly', (tx, done) => {
      const task = tx.objectStore('tasks').get(owner)
      const file = tx.objectStore('files').get(owner)
      file.onsuccess = () => done(task.result ? { task: task.result, file: file.result } : null)
    }),
    saveFile: (owner, file) => transaction(['files'], 'readwrite', tx => tx.objectStore('files').put(file, owner)),
    saveTask: (owner, task) => transaction(['tasks'], 'readwrite', tx => tx.objectStore('tasks').put(task, owner)),
    removeFile: owner => transaction(['files'], 'readwrite', tx => tx.objectStore('files').delete(owner)),
    clear: owner => transaction(['tasks', 'files'], 'readwrite', tx => {
      tx.objectStore('tasks').delete(owner)
      tx.objectStore('files').delete(owner)
    }),
  }
}
