import { createContext, useContext } from 'react'
import type { Errors, FileMeta, FormState } from '../lib/types'

export interface FormCtx {
  data: FormState
  files: FileMeta[]
  errors: Errors
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  patch: (p: Partial<FormState>) => void
  touch: (key: string) => void
  addFiles: (docType: string, files: File[], notes?: (string | undefined)[]) => void
  removeFile: (id: string) => void
}

export const FormContext = createContext<FormCtx | null>(null)

export function useForm() {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useForm outside FormContext')
  return ctx
}

export function useField<K extends keyof FormState>(name: K) {
  const { data, errors, set, touch } = useForm()
  const id = `f-${String(name)}`
  const error = errors[name as string]
  return {
    id,
    name: String(name),
    value: data[name],
    error,
    set: (v: FormState[K]) => set(name, v),
    blur: () => touch(String(name)),
    describedBy: error ? `${id}-err` : `${id}-hint`,
  }
}
