// Draft persistence: form fields in localStorage, uploaded files in IndexedDB.
// Nothing the user types is ever kept only in memory.
import type { Acknowledgement, FileMeta, FormState, StepId } from './types'

const DRAFT_KEY = 'tin-registration:draft:v1'
const ACK_KEY = 'tin-registration:ack:v1'

export interface Draft {
  data: FormState
  files: FileMeta[]
  step: StepId
  maxStep: number
  savedAt: number
}

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function safeSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadDraft = () => safeGet<Draft>(DRAFT_KEY)
export const saveDraft = (d: Draft) => safeSet(DRAFT_KEY, d)
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export const loadAck = () => safeGet<Acknowledgement>(ACK_KEY)
export const saveAck = (a: Acknowledgement) => safeSet(ACK_KEY, a)
export const clearAck = () => {
  try {
    localStorage.removeItem(ACK_KEY)
  } catch {
    /* ignore */
  }
}

// ---- IndexedDB file store ----
const DB_NAME = 'tin-registration'
const STORE = 'files'
let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    dbPromise.catch(() => (dbPromise = null))
  }
  return dbPromise
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(r.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export const putFile = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const getFile = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const deleteFile = (id: string) => tx('readwrite', (s) => s.delete(id))
export async function deleteFilesExcept(keep: string[]) {
  const keys = (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) as string[]
  await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => deleteFile(k)))
}
