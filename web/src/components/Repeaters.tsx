import { Briefcase, Plus, Trash2, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { BIZ_REG_TYPES, GENDERS } from '../lib/config'
import type { Business, Child } from '../lib/types'
import { useForm } from './form'
import { RowInput } from './ui'

const today = new Date().toISOString().slice(0, 10)

function Card({ icon, title, onRemove, children }: { icon: ReactNode; title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 animate-slide-up dark:border-slate-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {icon} {title}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:hover:bg-red-950/40"
        >
          <Trash2 className="size-3.5" /> Remove
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50/50 focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none dark:border-slate-700 dark:text-brand-300 dark:hover:bg-brand-900/20"
    >
      <Plus className="size-4" /> {children}
    </button>
  )
}

function useRows<T extends { id: string }>(key: 'children' | 'businesses') {
  const { data, patch, errors, touch } = useForm()
  const rows = data[key] as unknown as T[]
  const update = (id: string, p: Partial<T>) => patch({ [key]: rows.map((r) => (r.id === id ? { ...r, ...p } : r)) } as never)
  const remove = (id: string) => patch({ [key]: rows.filter((r) => r.id !== id) } as never)
  const add = (row: T) => {
    patch({ [key]: [...rows, row] } as never)
    setTimeout(() => document.getElementById(`f-${key}.${row.id}.name`)?.focus(), 30)
  }
  const field = (id: string, name: keyof T & string) => {
    const k = `${key}.${id}.${name}`
    return { id: `f-${k}`, error: errors[k], onBlur: () => touch(k) }
  }
  return { rows, update, remove, add, field }
}

export function ChildrenEditor() {
  const { rows, update, remove, add, field } = useRows<Child>('children')
  return (
    <div className="space-y-3 sm:col-span-2">
      {rows.map((c, i) => (
        <Card key={c.id} icon={<UserRound className="size-4 text-slate-400" />} title={c.name || `Child ${i + 1}`} onRemove={() => remove(c.id)}>
          <RowInput {...field(c.id, 'name')} label="Name" required value={c.name} onChange={(v) => update(c.id, { name: v })} className="sm:col-span-2" />
          <RowInput {...field(c.id, 'dob')} label="Date of birth" required type="date" max={today} value={c.dob} onChange={(v) => update(c.id, { dob: v })} />
          <RowInput {...field(c.id, 'gender')} label="Gender" required options={GENDERS} value={c.gender} onChange={(v) => update(c.id, { gender: v })} />
          <RowInput {...field(c.id, 'nic')} label="NIC or TIN" optional value={c.nic} onChange={(v) => update(c.id, { nic: v.toUpperCase() })} className="sm:col-span-2" />
        </Card>
      ))}
      <AddButton onClick={() => add({ id: crypto.randomUUID(), name: '', nic: '', dob: '', gender: '' })}>{rows.length ? 'Add another child' : 'Add a child'}</AddButton>
    </div>
  )
}

export function BusinessesEditor() {
  const { rows, update, remove, add, field } = useRows<Business>('businesses')
  return (
    <div className="space-y-3 sm:col-span-2">
      {rows.map((b, i) => (
        <Card key={b.id} icon={<Briefcase className="size-4 text-slate-400" />} title={b.name || `Business ${i + 1}`} onRemove={() => remove(b.id)}>
          <RowInput {...field(b.id, 'name')} label="Name of business" required value={b.name} onChange={(v) => update(b.id, { name: v.toUpperCase() })} className="sm:col-span-2" />
          <RowInput {...field(b.id, 'regType')} label="Registration type" required options={BIZ_REG_TYPES} value={b.regType} onChange={(v) => update(b.id, { regType: v })} />
          <RowInput {...field(b.id, 'regNo')} label="Registration number" required value={b.regNo} onChange={(v) => update(b.id, { regNo: v.toUpperCase() })} />
          <RowInput {...field(b.id, 'activity')} label="Principal activity" required placeholder="e.g. Retail sale of clothing" value={b.activity} onChange={(v) => update(b.id, { activity: v })} className="sm:col-span-2" />
          <RowInput {...field(b.id, 'commencementDate')} label="Date business started" required type="date" max={today} value={b.commencementDate} onChange={(v) => update(b.id, { commencementDate: v })} />
          <div className="hidden sm:block" />
          <RowInput {...field(b.id, 'line1')} label="Business address" required value={b.line1} onChange={(v) => update(b.id, { line1: v })} className="sm:col-span-2" />
          <RowInput {...field(b.id, 'line2')} label="Address line 2" optional value={b.line2} onChange={(v) => update(b.id, { line2: v })} />
          <RowInput {...field(b.id, 'line3')} label="City / town" optional value={b.line3} onChange={(v) => update(b.id, { line3: v })} />
          <RowInput {...field(b.id, 'postalCode')} label="Postal code" optional inputMode="numeric" value={b.postalCode} onChange={(v) => update(b.id, { postalCode: v.replace(/\D/g, '').slice(0, 10) })} />
        </Card>
      ))}
      <AddButton onClick={() => add({ id: crypto.randomUUID(), name: '', regType: '5', regNo: '', activity: '', commencementDate: '', line1: '', line2: '', line3: '', postalCode: '' })}>
        {rows.length ? 'Add another business' : 'Add a registered business'}
      </AddButton>
    </div>
  )
}
