import { AlertCircle, Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { FormState, Option } from '../lib/types'
import { useField } from './form'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Field shell
// ---------------------------------------------------------------------------
interface ShellProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
  className?: string
  labelAside?: ReactNode
  as?: 'div' | 'fieldset'
}

export function FieldShell({ id, label, hint, error, required, optional, children, className, labelAside, as = 'div' }: ShellProps) {
  const LabelTag = as === 'fieldset' ? 'legend' : 'label'
  const Tag = as
  return (
    <Tag className={cx('min-w-0', className)} data-field={id}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <LabelTag {...(as === 'div' ? { htmlFor: id } : {})} className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
          {optional && <span className="ml-1.5 text-xs font-normal text-slate-500">(optional)</span>}
        </LabelTag>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-red-600 animate-fade-in dark:text-red-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </Tag>
  )
}

type StringKeys = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState]
type BoolKeys = { [K in keyof FormState]: FormState[K] extends boolean ? K : never }[keyof FormState]

interface BaseProps {
  name: StringKeys
  label: ReactNode
  hint?: ReactNode
  required?: boolean
  optional?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
export function TextField({
  name, label, hint, required, optional, className, type = 'text', inputMode, autoComplete, placeholder, transform, maxLength, onBlurValue, prefix, onValue, aside, lang,
}: BaseProps & {
  onValue?: (v: string) => void
  aside?: ReactNode
  lang?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  placeholder?: string
  transform?: (v: string) => string
  maxLength?: number
  onBlurValue?: (v: string) => string
  prefix?: ReactNode
}) {
  const f = useField(name)
  return (
    <FieldShell id={f.id} label={label} hint={hint} error={f.error} required={required} optional={optional} className={className} labelAside={aside}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{prefix}</span>}
        <input
          id={f.id}
          name={f.name}
          type={type}
          lang={lang}
          className={cx('input', prefix ? 'pl-10' : '')}
          value={f.value as string}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={!!f.error}
          aria-required={required}
          aria-describedby={f.describedBy}
          onChange={(e) => (onValue ? onValue(e.target.value) : f.set((transform ? transform(e.target.value) : e.target.value) as never))}
          onBlur={(e) => {
            if (onBlurValue) {
              const nv = onBlurValue(e.target.value)
              if (nv !== e.target.value) f.set(nv as never)
            }
            f.blur()
          }}
        />
      </div>
    </FieldShell>
  )
}

export function TextareaField({ name, label, hint, required, optional, className, maxLength, rows = 3, placeholder, disabled }: BaseProps & {
  maxLength?: number
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  const f = useField(name)
  const len = (f.value as string).length
  const counter = maxLength ? (
    <span className={cx('text-xs tabular-nums', maxLength - len < 50 ? 'text-amber-600' : 'text-slate-500')} aria-live="polite">
      {maxLength - len} characters left
    </span>
  ) : null
  return (
    <FieldShell id={f.id} label={label} hint={hint} error={f.error} required={required} optional={optional} className={className} labelAside={counter}>
      <textarea
        id={f.id}
        name={f.name}
        className="input resize-y"
        rows={rows}
        value={f.value as string}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!f.error}
        aria-describedby={f.describedBy}
        onChange={(e) => f.set(e.target.value as never)}
        onBlur={f.blur}
      />
    </FieldShell>
  )
}

export function SelectField({ name, label, hint, required, optional, className, options, placeholder = 'Select…', onValue }: BaseProps & {
  options: Option[]
  placeholder?: string
  onValue?: (v: string) => void
}) {
  const f = useField(name)
  return (
    <FieldShell id={f.id} label={label} hint={hint} error={f.error} required={required} optional={optional} className={className}>
      <div className="relative">
        <select
          id={f.id}
          name={f.name}
          className={cx('input appearance-none pr-10', !f.value && 'text-slate-400')}
          value={f.value as string}
          aria-invalid={!!f.error}
          aria-describedby={f.describedBy}
          onChange={(e) => (onValue ? onValue(e.target.value) : f.set(e.target.value as never))}
          onBlur={f.blur}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-slate-900 dark:text-slate-100">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </div>
    </FieldShell>
  )
}

export function DateField({ name, label, hint, required, className, max, min }: BaseProps & { max?: string; min?: string }) {
  const f = useField(name)
  return (
    <FieldShell id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <input
        id={f.id}
        name={f.name}
        type="date"
        className="input"
        value={f.value as string}
        max={max}
        min={min}
        aria-invalid={!!f.error}
        aria-describedby={f.describedBy}
        onChange={(e) => f.set(e.target.value as never)}
        onBlur={f.blur}
      />
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Segmented radio / radio cards
// ---------------------------------------------------------------------------
export function SegmentedField({ name, label, hint, required, className, options }: BaseProps & { options: Option[] }) {
  const f = useField(name)
  return (
    <FieldShell as="fieldset" id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <div id={f.id} role="radiogroup" aria-describedby={f.describedBy} className="inline-flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = f.value === o.value
          return (
            <label
              key={o.value}
              className={cx(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition select-none',
                'has-focus-visible:ring-4 has-focus-visible:ring-brand-500/20',
                checked
                  ? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={f.name}
                value={o.value}
                checked={checked}
                onChange={() => {
                  f.set(o.value as never)
                  f.blur()
                }}
              />
              <span
                className={cx(
                  'grid size-4 place-items-center rounded-full border',
                  checked ? 'border-brand-600 bg-brand-600 dark:border-brand-400 dark:bg-brand-400' : 'border-slate-400',
                )}
                aria-hidden
              >
                {checked && <span className="size-1.5 rounded-full bg-white dark:bg-slate-900" />}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
    </FieldShell>
  )
}

export function CheckboxField({ name, label, hint, className }: { name: BoolKeys; label: ReactNode; hint?: ReactNode; className?: string }) {
  const f = useField(name)
  return (
    <div className={className} data-field={f.id}>
      <label
        className={cx(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
          f.error ? 'border-red-400 bg-red-50/50 dark:bg-red-950/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
          f.value && !f.error && 'border-brand-300 bg-brand-50/50 dark:border-brand-700 dark:bg-brand-900/20',
        )}
      >
        <input
          id={f.id}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-brand-600"
          checked={f.value as boolean}
          aria-invalid={!!f.error}
          aria-describedby={f.describedBy}
          onChange={(e) => {
            f.set(e.target.checked as never)
            f.blur()
          }}
        />
        <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {label}
          {hint && <span id={`${f.id}-hint`} className="mt-1 block text-slate-500">{hint}</span>}
        </span>
      </label>
      {f.error && (
        <p id={`${f.id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4" aria-hidden />
          {f.error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Combobox — searchable, keyboard accessible, optional free text, async options.
// ---------------------------------------------------------------------------
export function ComboField({
  name, label, hint, required, optional, className, options, load, deps = [], freeText, placeholder, disabled, disabledHint, transform,
}: BaseProps & {
  options?: Option[]
  load?: (q: string) => Promise<Option[]>
  deps?: unknown[]
  freeText?: boolean
  placeholder?: string
  disabled?: boolean
  disabledHint?: string
  transform?: (v: string) => string
}) {
  const f = useField(name)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null) // null = not typing, show value
  const [loaded, setLoaded] = useState<Option[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!load || disabled) return
    let live = true
    setLoading(true)
    load('').then((o) => live && setLoaded(o)).finally(() => live && setLoading(false))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, ...deps])

  const all = options ?? loaded ?? []
  const current = all.find((o) => o.value === f.value)
  const display = query ?? (current?.label ?? (f.value as string))
  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    if (!q) return all
    const words = q.split(/\s+/)
    return all.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)))
  }, [all, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (o: Option) => {
    f.set(o.value as never)
    setQuery(null)
    setOpen(false)
    f.blur()
  }

  const commit = () => {
    if (query !== null) {
      const exact = all.find((o) => o.label.toLowerCase() === query.trim().toLowerCase())
      if (exact) f.set(exact.value as never)
      else if (freeText) f.set((transform ? transform(query) : query).trim() as never)
      else if (!query.trim()) f.set('' as never)
    }
    setQuery(null)
    setOpen(false)
    f.blur()
  }

  const isDisabled = disabled
  return (
    <FieldShell
      id={f.id}
      label={label}
      hint={isDisabled && disabledHint ? disabledHint : hint}
      error={f.error}
      required={required}
      optional={optional}
      className={className}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          id={f.id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          aria-invalid={!!f.error}
          aria-describedby={f.describedBy}
          autoComplete="off"
          disabled={isDisabled}
          className="input pr-10 pl-10"
          placeholder={placeholder ?? (freeText ? 'Type or choose…' : 'Search…')}
          value={display}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(transform ? transform(e.target.value) : e.target.value)
            setOpen(true)
          }}
          onBlur={(e) => {
            if (listRef.current?.contains(e.relatedTarget as Node)) return
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              if (open && filtered[active] && (query !== null || !f.value)) {
                e.preventDefault()
                choose(filtered[active])
              } else if (open) {
                e.preventDefault()
                commit()
              }
            } else if (e.key === 'Escape') {
              if (open) {
                e.preventDefault()
                setQuery(null)
                setOpen(false)
              }
            }
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
        </span>
        {open && !isDisabled && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10 animate-fade-in dark:border-slate-700 dark:bg-slate-900"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-slate-500">
                {loading ? 'Loading…' : freeText && query ? <>Press Enter to use “{query}”</> : 'No matches'}
              </li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-idx={i}
                role="option"
                aria-selected={o.value === f.value}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
                  i === active ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-50' : 'text-slate-700 dark:text-slate-300',
                )}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o)
                }}
              >
                <span>{o.label}</span>
                {o.value === f.value && <Check className="size-4 shrink-0 text-brand-600" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function Button({
  variant = 'primary', size = 'md', className, loading, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'px-5 py-2.5 text-[15px]' : 'px-3 py-1.5 text-sm',
        variant === 'primary' && 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:ring-brand-500/30 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/30',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function Callout({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'error' | 'success'; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-xl border p-4 text-sm leading-relaxed',
        tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checkbox group (string[] field)
// ---------------------------------------------------------------------------
type ArrayKeys = { [K in keyof FormState]: FormState[K] extends string[] ? K : never }[keyof FormState]

export function CheckboxGroupField({ name, label, hint, required, className, options }: {
  name: ArrayKeys
  label: ReactNode
  hint?: ReactNode
  required?: boolean
  className?: string
  options: Option[]
}) {
  const f = useField(name)
  const value = f.value as string[]
  return (
    <FieldShell as="fieldset" id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <div id={f.id} tabIndex={-1} aria-describedby={f.describedBy} className="flex flex-wrap gap-2 outline-none">
        {options.map((o) => {
          const checked = value.includes(o.value)
          return (
            <label
              key={o.value}
              className={cx(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition select-none',
                'has-focus-visible:ring-4 has-focus-visible:ring-brand-500/20',
                checked
                  ? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => {
                  f.set((checked ? value.filter((v) => v !== o.value) : [...value, o.value]) as never)
                  f.blur()
                }}
              />
              <span
                className={cx('grid size-4 place-items-center rounded border', checked ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-slate-900' : 'border-slate-400')}
                aria-hidden
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Uncontrolled-by-context input for repeatable rows (children, businesses).
// ---------------------------------------------------------------------------
export function RowInput({ id, label, value, onChange, onBlur, error, required, optional, type = 'text', options, className, placeholder, max, inputMode }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string
  required?: boolean
  optional?: boolean
  type?: string
  options?: Option[]
  className?: string
  placeholder?: string
  max?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  const common = {
    id,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-err` : undefined,
    onBlur,
  }
  return (
    <FieldShell id={id} label={label} error={error} required={required} optional={optional} className={className}>
      {options ? (
        <div className="relative">
          <select {...common} className={cx('input appearance-none pr-10', !value && 'text-slate-400')} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value} className="text-slate-900 dark:text-slate-100">{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
      ) : (
        <input {...common} type={type} className="input" value={value} max={max} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
    </FieldShell>
  )
}
