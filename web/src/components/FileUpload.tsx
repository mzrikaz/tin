import { AlertCircle, CheckCircle2, FileText, ImageIcon, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CONVERTIBLE_EXTS, FILE_ACCEPT, FILE_EXTS, FILE_MAX_BYTES, FILES_TOTAL_MAX_BYTES, type DocumentType } from '../lib/config'
import { getFile } from '../lib/draft'
import type { FileMeta } from '../lib/types'
import { useForm } from './form'
import { cx } from './ui'

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

function Thumb({ meta }: { meta: FileMeta }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!meta.type.startsWith('image/')) return
    let u: string | null = null
    getFile(meta.id).then((b) => {
      if (b) setUrl((u = URL.createObjectURL(b)))
    })
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [meta.id, meta.type])
  if (url) return <img src={url} alt="" className="size-10 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
  return (
    <span className="grid size-10 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
      {meta.type.startsWith('image/') ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
    </span>
  )
}

export function FileUpload({ doc }: { doc: DocumentType }) {
  const { files, errors, addFiles, removeFile } = useForm()
  const mine = files.filter((f) => f.docType === doc.id)
  const [drag, setDrag] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = `f-doc:${doc.id}`
  const error = localError ?? errors[`doc:${doc.id}`]

  const accept = async (list: FileList | null) => {
    if (!list?.length) return
    const ok: { file: File; note?: string }[] = []
    const bad: string[] = []
    let total = files.reduce((n, f) => n + f.size, 0)
    for (const original of Array.from(list)) {
      try {
        const res = await prepareFile(original)
        if ('error' in res) {
          bad.push(res.error)
          continue
        }
        const dup = [...mine, ...ok.map((x) => ({ name: x.file.name }))].some((m) => m.name.toLowerCase() === res.file.name.toLowerCase())
        if (dup) {
          bad.push(`${res.file.name} is already attached here.`)
          continue
        }
        if (total + res.file.size > FILES_TOTAL_MAX_BYTES) {
          bad.push(`${res.file.name} would take you over the ${formatBytes(FILES_TOTAL_MAX_BYTES)} total limit.`)
          continue
        }
        total += res.file.size
        ok.push(res)
      } catch {
        bad.push(`${original.name} couldn’t be read. Try saving it again or choose a different file.`)
      }
    }
    setLocalError(bad.length ? bad.join(' ') : null)
    if (ok.length) addFiles(doc.id, ok.map((x) => x.file), ok.map((x) => x.note))
  }

  return (
    <div data-field={id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {mine.length > 0 ? (
              <CheckCircle2 className="size-4 text-emerald-600" aria-label="Uploaded" />
            ) : (
              <span className={cx('size-2 rounded-full', doc.required ? 'bg-amber-500' : 'bg-slate-300')} aria-hidden />
            )}
            {doc.label}
            {!doc.required && <span className="text-xs font-normal text-slate-500">(optional)</span>}
          </p>
          {doc.hint && <p className="mt-0.5 ml-4 text-sm text-slate-500">{doc.hint}</p>}
        </div>
      </div>

      {mine.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 pr-3 animate-slide-up dark:bg-slate-800/50">
              <Thumb meta={m} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{m.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(m.size)} · saved on this device{m.note ? ` · ${m.note}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(m.id)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:hover:bg-slate-700"
                aria-label={`Remove ${m.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          accept(e.dataTransfer.files)
        }}
        className={cx(
          'mt-3 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition',
          drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : error ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700',
        )}
      >
        <UploadCloud className={cx('size-6', drag ? 'text-brand-600' : 'text-slate-400')} aria-hidden />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <button
            type="button"
            id={id}
            onClick={() => input.current?.click()}
            className="font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300"
            aria-describedby={error ? `${id}-err` : undefined}
          >
            {mine.length ? 'Add another file' : 'Choose file'}
          </button>{' '}
          or drag it here
        </p>
        <p className="text-xs text-slate-500">PDF, JPG, Word, Excel · photos are converted to JPG · up to {formatBytes(FILE_MAX_BYTES)} each</p>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept={FILE_ACCEPT}
          multiple
          onChange={(e) => {
            accept(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// IRD accepts PDF/JPG/JPEG/DOC/DOCX/XLS/XLSX/TXT/CSV, ≤10 MB, no ~#%&*+:<>?/{|} in names.
// Photos in other formats (PNG, WebP…) are converted to JPEG, and oversized photos are downscaled.
// ---------------------------------------------------------------------------
const INVALID_NAME_CHARS = /[~#%&*+:<>?/\\{|}]/g

function cleanName(name: string) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(INVALID_NAME_CHARS, '-').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '').trim() || 'document'
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return { base: base.slice(0, 120), ext }
}

async function toJpeg(file: Blob, maxSide = 3000, quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality))
}

async function prepareFile(file: File): Promise<{ file: File; note?: string } | { error: string }> {
  if (file.size === 0) return { error: `${file.name} is empty.` }
  const { base, ext } = cleanName(file.name)
  const renamed = `${base}.${ext}` !== file.name
  const isImage = file.type.startsWith('image/') || CONVERTIBLE_EXTS.includes(ext)

  if (CONVERTIBLE_EXTS.includes(ext) || (isImage && !FILE_EXTS.includes(ext))) {
    try {
      let blob = await toJpeg(file)
      if (blob.size > FILE_MAX_BYTES) blob = await toJpeg(file, 2000, 0.8)
      if (blob.size > FILE_MAX_BYTES) return { error: `${file.name} is too large even after compressing.` }
      return { file: new File([blob], `${base}.jpg`, { type: 'image/jpeg' }), note: `converted from ${ext.toUpperCase() || 'image'} to JPG` }
    } catch {
      return { error: `${file.name}: this image format isn’t supported. Please save it as JPG or PDF.` }
    }
  }
  if (!FILE_EXTS.includes(ext)) return { error: `${file.name}: only PDF, JPG, Word, Excel, TXT or CSV files are accepted.` }

  if (file.size > FILE_MAX_BYTES) {
    if (ext === 'jpg' || ext === 'jpeg') {
      try {
        const blob = await toJpeg(file, 2500, 0.82)
        if (blob.size <= FILE_MAX_BYTES) return { file: new File([blob], `${base}.jpg`, { type: 'image/jpeg' }), note: 'compressed to fit the 10 MB limit' }
      } catch {
        /* fall through */
      }
    }
    return { error: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(FILE_MAX_BYTES)} per file.` }
  }
  if (renamed) return { file: new File([file], `${base}.${ext}`, { type: file.type }), note: 'renamed for IRD' }
  return { file }
}
