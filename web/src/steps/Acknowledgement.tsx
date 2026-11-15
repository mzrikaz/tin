import { AlertTriangle, Check, Copy, FileDown, FileText, Printer, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, cx } from '../components/ui'
import { ackFields, DECLARATION, downloadAckPdf } from '../lib/ackPdf'
import { entityByKey } from '../lib/config'
import type { Acknowledgement as Ack } from '../lib/types'
import { summarise, SummaryList } from './StepReview'

/** Strip scripts/handlers from IRD's HTML before showing it in a sandboxed frame. */
function sanitise(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, link, meta, form input[type=button], button').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((a) => a.name.startsWith('on') && el.removeAttribute(a.name)))
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:13px/1.5 Arial,sans-serif;color:#111;margin:16px}table{border-collapse:collapse}td{padding:4px 8px;vertical-align:top}</style></head><body>${doc.body.innerHTML}</body></html>`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,190px)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold break-all text-slate-900">{value}</dd>
    </div>
  )
}

export function Acknowledgement({ ack, onNew }: { ack: Ack; onNew: () => void }) {
  const [copied, setCopied] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const entity = entityByKey(ack.data.entityType)
  const f = ackFields(ack)
  const sections = summarise(ack.data, ack.files)

  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadAckPdf(ack)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-slide-up">
      <div className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className={cx('px-6 py-10 text-center text-white sm:px-10', f.demo ? 'bg-linear-to-br from-amber-600 to-amber-800' : 'bg-linear-to-br from-brand-700 to-brand-900')}>
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-white/15 ring-8 ring-white/10">
            {f.demo ? <AlertTriangle className="size-7" /> : <Check className="size-7" strokeWidth={3} />}
          </div>
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{f.demo ? 'Demo submission — not sent to IRD' : 'Successfully submitted to IRD'}</h1>
          <p className="mt-2 text-white/80">
            {entity?.label} · {f.dateTime}
          </p>
          <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-xl bg-white/10 px-6 py-3">
            <span className="text-xs tracking-wider text-white/80 uppercase">Acknowledgement No.</span>
            <span className="mt-0.5 flex items-center gap-2 font-mono text-2xl font-bold tracking-wide">
              {ack.referenceNo}
              <button
                type="button"
                className="no-print rounded-md p-1 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                aria-label="Copy acknowledgement number"
                onClick={() => {
                  navigator.clipboard?.writeText(ack.referenceNo)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </span>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-10">
          <div className="no-print flex flex-wrap gap-3">
            <Button onClick={pdf} loading={pdfBusy}>
              {!pdfBusy && <FileDown className="size-4" />} Download acknowledgement (PDF)
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </div>

          {/* Same content and order as IRD's acknowledgement PDF. */}
          <section className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-inner">
            <div className="text-center">
              <p className="text-lg font-bold tracking-wide">ACKNOWLEDGEMENT</p>
              <p className="text-sm font-semibold tracking-wide">TAXPAYER REGISTRATION</p>
            </div>
            <dl className="mt-4 border-t border-slate-200 pt-3">
              <Row label="Applicant reference No." value={f.reference} />
              <Row label="Name of applicant" value={f.name} />
            </dl>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-sm font-bold">DECLARATION</p>
              <p className="mt-1 text-sm">I declare that:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {DECLARATION.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <dl className="mt-3">
                <Row label="Name of applicant" value={f.name} />
                <Row label="Designation of applicant" value={f.designation} />
                <Row label="Contact number" value={f.contact} />
              </dl>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className={cx('text-sm font-bold', f.demo ? 'text-amber-700' : 'text-emerald-700')}>{f.demo ? 'DEMO — NOT TRANSMITTED TO IRD' : 'SUCCESSFUL TRANSMISSION'}</p>
              <dl className="mt-1">
                <Row label="Acknowledgement No." value={f.ackNo} />
                <Row label="Date / Time" value={f.dateTime} />
              </dl>
              <p className="mt-2 text-sm">{f.demo ? 'This is a demo. Nothing was sent to IRD.' : 'You had successfully submitted the following request:'}</p>
              <p className="mt-1 pl-4 text-sm font-semibold">{f.request}</p>
              {!f.demo && <p className="mt-2 text-sm">A notification will be mailed to you within 5 working days.</p>}
            </div>
          </section>

          {ack.irdHtml && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-800">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                <FileText className="size-4" /> IRD’s original acknowledgement
              </summary>
              <div className="px-5 pb-5">
                <iframe ref={frame} title="IRD acknowledgement" sandbox="allow-modals" srcDoc={sanitise(ack.irdHtml)} className="h-120 w-full rounded-lg border border-slate-200 bg-white" />
                <Button variant="secondary" size="sm" className="no-print mt-3" onClick={() => frame.current?.contentWindow?.print()}>
                  <Printer className="size-4" /> Print IRD’s version
                </Button>
              </div>
            </details>
          )}

          <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
            <summary className="cursor-pointer list-none px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
              Your submitted details <span className="text-sm font-normal text-slate-500 group-open:hidden">(show)</span>
            </summary>
            <div className="space-y-5 px-5 pb-5">
              {sections.map((s) => (
                <div key={s.step}>
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{s.title}</h3>
                  <SummaryList rows={s.rows} />
                </div>
              ))}
            </div>
          </details>

          {!f.demo && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              IRD will notify you within 5 working days{ack.data.email ? ` at ${ack.data.email}` : ''}. Keep your acknowledgement number for any enquiries.
            </p>
          )}

          <div className="no-print flex">
            <Button variant="ghost" onClick={onNew} className="ml-auto">
              <RotateCcw className="size-4" /> Start a new registration
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
