import { Building, Building2, Check, ChevronDown, Flag, FolderKanban, Globe, Handshake, HeartHandshake, Landmark, MonitorSmartphone, PiggyBank, ScrollText, Shapes, Split, Store, User, Users, Warehouse } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useForm } from '../components/form'
import { cx } from '../components/ui'
import { AlertCircle } from 'lucide-react'
import { ENTITY_TYPES, type EntityKind } from '../lib/config'

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  individual: User,
  individual_foreign: Globe,
  company: Building2,
  partnership: Handshake,
  foreign_company: Building,
  trust: ScrollText,
  ngo: HeartHandshake,
  charity: HeartHandshake,
  coop: Store,
  branch: Split,
  joint_venture: Handshake,
  association: Users,
  government: Landmark,
  semi_government: Warehouse,
  provident_fund: PiggyBank,
  embassy: Flag,
  project: FolderKanban,
  other: Shapes,
  dsp: MonitorSmartphone,
}

const GROUPS: { kind: EntityKind; title: string }[] = [
  { kind: 'individual', title: 'A person' },
  { kind: 'organisation', title: 'An organisation' },
  { kind: 'dsp', title: 'An overseas business' },
]

export function StepType() {
  const { data, patch, errors, touch } = useForm()
  const selected = ENTITY_TYPES.find((e) => e.key === data.entityType)
  const [more, setMore] = useState(() => !!selected && !selected.common)
  return (
    <div className="space-y-7" data-field="f-entityType">
      {GROUPS.map((g) => (
        <fieldset key={g.kind}>
          <legend className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{g.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTITY_TYPES.filter((e) => e.kind === g.kind && (e.common || more)).map((e, i) => {
              const Icon = ICONS[e.key] ?? User
              const checked = data.entityType === e.key
              return (
                <label
                  key={e.key}
                  className={cx(
                    'group relative flex cursor-pointer gap-4 rounded-xl border p-4 transition',
                    'has-focus-visible:ring-4 has-focus-visible:ring-brand-500/25',
                    checked
                      ? 'border-brand-600 bg-brand-50 shadow-sm dark:border-brand-400 dark:bg-brand-900/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
                  )}
                >
                  <input
                    type="radio"
                    name="entityType"
                    id={g.kind === 'individual' && i === 0 ? 'f-entityType' : undefined}
                    value={e.key}
                    checked={checked}
                    className="sr-only"
                    onChange={() => {
                      const p: Parameters<typeof patch>[0] = { entityType: e.key }
                      if (e.kind === 'dsp' && !data.purposeCode) p.purposeCode = '8'
                      patch(p)
                      touch('entityType')
                    }}
                  />
                  <span
                    className={cx(
                      'grid size-11 shrink-0 place-items-center rounded-lg transition',
                      checked
                        ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 pr-6">
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{e.label}</span>
                    <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{e.description}</span>
                  </span>
                  {checked && (
                    <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand-700 text-white animate-fade-in dark:bg-brand-400 dark:text-slate-950">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          {g.kind === 'organisation' && (
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-brand-900/40"
            >
              {more ? 'Show fewer types' : `Show ${ENTITY_TYPES.filter((e) => e.kind === 'organisation' && !e.common).length} more types (trust, NGO, charity, co-op, government…)`}
              <ChevronDown className={more ? 'size-4 rotate-180 transition' : 'size-4 transition'} />
            </button>
          )}
        </fieldset>
      ))}
      {errors.entityType && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4" /> {errors.entityType}
        </p>
      )}
    </div>
  )
}
