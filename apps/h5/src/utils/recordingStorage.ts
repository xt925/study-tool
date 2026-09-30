const DB_NAME = 'english-h5-recordings'
const STORE_NAME = 'recordings'

export interface SavedRecording {
  blob: Blob
  attemptId: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveRecording(id: string, recording: SavedRecording): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(recording, id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function loadRecording(id: string): Promise<SavedRecording | null> {
  const db = await openDatabase()
  try {
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const record = stored as Partial<SavedRecording> | undefined
    if (!record || !(record.blob instanceof Blob)) return null
    if (typeof record.attemptId !== 'string' || !record.attemptId) return null
    return { blob: record.blob, attemptId: record.attemptId }
  } finally {
    db.close()
  }
}