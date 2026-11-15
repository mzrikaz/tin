import { ExternalLink } from 'lucide-react'
import type { SubmitAction } from '../lib/api'

export function ActionLinks({ actions }: { actions?: SubmitAction[] }) {
  if (!actions?.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a) => (
        <a
          key={a.href}
          href={a.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
        >
          {a.label} <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(opens IRD website in a new tab)</span>
        </a>
      ))}
    </div>
  )
}
