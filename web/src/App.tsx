import { AlertTriangle, ArrowLeft, ArrowRight, Check, CloudCheck, CloudOff, Loader2, RotateCcw, Send, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FormContext, type FormCtx } from './components/form'
import { Button, Callout, cx } from './components/ui'
import { api, isMock, type Captcha, type SubmitAction } from './lib/api'
import { ActionLinks } from './components/ActionLinks'
import { entityByKey } from './lib/config'
import { loadGeo } from './lib/geo'
import { clearAck, clearDraft, deleteFile, deleteFilesExcept, getFile, loadAck, loadDraft, putFile, saveAck, saveDraft } from './lib/draft'
import { DEFAULTED_FIELDS, EMPTY_FORM, type Acknowledgement as Ack, type Errors, type FileMeta, type FormState, type StepId } from './lib/types'
import { STEP_ORDER, stepOfField, validateAll, validateStep } from './lib/validation'
import { Acknowledgement } from './steps/Acknowledgement'
import { StepContact } from './steps/StepContact'
import { StepDetails } from './steps/StepDetails'
import { StepPurpose } from './steps/StepPurpose'
import { StepReview } from './steps/StepReview'
import { StepType } from './steps/StepType'

// ---------------------------------------------------------------------------
const STEP_META: Record<StepId, { nav: string; title: (d: FormState) => string; desc: string }> = {
  type: { nav: 'Taxpayer type', title: () => 'Who are you registering?', desc: 'Choose the option that best describes the taxpayer.' },
  details: {
    nav: 'Details',
    title: (d) => (entityByKey(d.entityType)?.kind === 'individual' ? 'Your details' : 'About the organisation'),
    desc: 'Enter details exactly as they appear on official documents.',
  },
  contact: { nav: 'Address & contact', title: () => 'Address and contact details', desc: 'How we reach you about your registration.' },
  purpose: { nav: 'Purpose & documents', title: () => 'Purpose and documents', desc: 'Tell us why you need a TIN and attach supporting documents.' },
  review: { nav: 'Review & submit', title: () => 'Check your answers', desc: 'Make sure everything is correct before you submit.' },
}

const hasContent = (d: FormState, files: FileMeta[]) =>
  files.length > 0 ||
  (Object.keys(d) as (keyof FormState)[]).some((k) => !DEFAULTED_FIELDS.includes(k) && JSON.stringify(d[k]) !== JSON.stringify(EMPTY_FORM[k]))

function relTime(ts: number, now: number) {
  const s = Math.round((now - ts) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface Toast {
  id: number
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; run: () => void }
}

// ---------------------------------------------------------------------------
export default function App() {
  const initial = useMemo(() => loadDraft(), [])
  const [ack, setAck] = useState<Ack | null>(() => {
    const a = loadAck()
    return a ? { ...a, data: { ...EMPTY_FORM, ...a.data }, files: a.files ?? [] } : null
  })
  const [data, setData] = useState<FormState>(() => {
    const d = { ...EMPTY_FORM, ...initial?.data } as FormState & { city?: string; landline?: string }
    // Migrate drafts saved by earlier versions.
    if (d.gender === 'M') d.gender = '1'
    if (d.gender === 'F') d.gender = '2'
    if (d.city && !d.addressLine3) d.addressLine3 = d.city
    if (d.landline && !d.officeNo) d.officeNo = d.landline
    delete d.city
    delete d.landline
    return d
  })
  const [files, setFiles] = useState<FileMeta[]>(() => (initial?.files ?? []).map((f) => (f.docType === '10092' ? { ...f, docType: 'nic' } : f)))
  const [maxStep, setMaxStep] = useState(() => initial?.maxStep ?? 0)
  const [step, setStep] = useState<StepId>(() => {
    const fromHash = location.hash.slice(1) as StepId
    const max = initial?.maxStep ?? 0
    if (STEP_ORDER.includes(fromHash) && STEP_ORDER.indexOf(fromHash) <= max) return fromHash
    return initial?.step ?? 'type'
  })
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [attempted, setAttempted] = useState<Set<StepId>>(() => new Set())
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const [returnToReview, setReturnToReview] = useState(false)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(initial ? 'saved' : 'idle')
  const [savedAt, setSavedAt] = useState<number | null>(initial?.savedAt ?? null)
  const [now, setNow] = useState(Date.now())
  const [online, setOnline] = useState(navigator.onLine)
  const [toasts, setToasts] = useState<Toast[]>([])

  const [captcha, setCaptcha] = useState<Captcha | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captchaError, setCaptchaError] = useState<string>()
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitActions, setSubmitActions] = useState<SubmitAction[]>([])

  const headingRef = useRef<HTMLHeadingElement>(null)
  const confirmRef = useRef<HTMLDialogElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const latest = useRef({ data, files, step, maxStep })
  latest.current = { data, files, step, maxStep }

  // ---- toasts ---------------------------------------------------------------
  const toast = useCallback((t: Omit<Toast, 'id'>, ms = 7000) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), ms)
  }, [])

  // ---- persistence: autosave every change, flush on hide ---------------------
  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    const l = latest.current
    if (!hasContent(l.data, l.files)) {
      setSaveState('idle')
      return
    }
    const ts = Date.now()
    if (saveDraft({ ...l, savedAt: ts })) {
      setSaveState('saved')
      setSavedAt(ts)
    } else setSaveState('error')
  }, [])

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (ack) return
    setSaveState('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(flush, 400)
  }, [data, files, step, maxStep, flush, ack])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush()
      if (submitting) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flush, submitting])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Preload address data so review/acknowledgement can show names.
  const [, setGeoLoaded] = useState(false)
  useEffect(() => {
    loadGeo().then(() => setGeoLoaded(true)).catch(() => {})
  }, [])

  // Welcome back.
  const welcomed = useRef(false)
  useEffect(() => {
    if (welcomed.current) return
    welcomed.current = true
    if (initial && hasContent(initial.data, initial.files) && !loadAck()) {
      toast({ message: `Welcome back — we restored your application from ${relTime(initial.savedAt, Date.now())}.`, action: { label: 'Start over', run: () => confirmRef.current?.showModal() } }, 9000)
    }
    // Drop orphaned blobs (e.g. from an earlier cleared draft).
    deleteFilesExcept((initial?.files ?? []).map((f) => f.id)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- history: browser back/forward moves between steps ---------------------
  useEffect(() => {
    history.replaceState({ step }, '', `#${step}`)
    const onPop = (e: PopStateEvent) => {
      const s = (e.state?.step ?? location.hash.slice(1)) as StepId
      if (STEP_ORDER.includes(s) && STEP_ORDER.indexOf(s) <= latest.current.maxStep) setStep(s)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = useCallback((s: StepId, opts: { push?: boolean } = {}) => {
    setStep(s)
    setMaxStep((m) => Math.max(m, STEP_ORDER.indexOf(s)))
    if (opts.push !== false) history.pushState({ step: s }, '', `#${s}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }, [])

  // ---- captcha on review ------------------------------------------------------
  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    try {
      setCaptcha(await api.getCaptcha())
      setCaptchaAnswer('')
    } catch {
      setCaptchaError('Couldn’t load the security code. Check your connection and tap refresh.')
    } finally {
      setCaptchaLoading(false)
    }
  }, [])
  useEffect(() => {
    if (step === 'review' && !captcha) refreshCaptcha()
  }, [step, captcha, refreshCaptcha])

  // ---- form context -------------------------------------------------------------
  const clearServerError = (key: string) =>
    setServerErrors((e) => {
      if (!(key in e)) return e
      const n = { ...e }
      delete n[key]
      return n
    })

  const ctx: FormCtx = {
    data,
    files,
    errors: {},
    set: (key, value) => {
      setData((d) => ({ ...d, [key]: value, ...(key === 'dob' || key === 'gender' ? { dobFromNic: false } : {}) }))
      clearServerError(key)
    },
    patch: (p) => {
      setData((d) => ({ ...d, ...p }))
      Object.keys(p).forEach(clearServerError)
    },
    touch: (key) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key))),
    addFiles: async (docType, list, notes = []) => {
      for (const [i, file] of list.entries()) {
        const meta: FileMeta = { id: crypto.randomUUID(), docType, name: file.name, size: file.size, type: file.type, note: notes[i] }
        try {
          await putFile(meta.id, file)
          setFiles((fs) => [...fs, meta])
          clearServerError(`doc:${docType}`)
        } catch {
          toast({ message: `Couldn’t save ${file.name} on this device (storage may be full or disabled).`, tone: 'error' })
        }
      }
    },
    removeFile: async (id) => {
      const meta = files.find((f) => f.id === id)
      if (!meta) return
      const blob = await getFile(id).catch(() => undefined)
      setFiles((fs) => fs.filter((f) => f.id !== id))
      deleteFile(id).catch(() => {})
      toast({
        message: `Removed ${meta.name}.`,
        action: blob
          ? {
              label: 'Undo',
              run: async () => {
                await putFile(meta.id, blob)
                setFiles((fs) => [...fs, meta])
              },
            }
          : undefined,
      })
    },
  }

  // Errors visible on the current step: live for touched fields, all after a Continue attempt.
  const stepErrors = validateStep(step, data, files)
  const visibleErrors: Errors = {}
  // Rows added after a Continue attempt (children, businesses) only show errors once touched.
  for (const [k, v] of Object.entries(stepErrors)) if (touched.has(k) || (attempted.has(step) && !k.includes('.'))) visibleErrors[k] = v
  for (const [k, v] of Object.entries(serverErrors)) if (stepOfField(k) === step) visibleErrors[k] = v
  ctx.errors = visibleErrors
  if (step === 'review' && !attempted.has('review')) delete visibleErrors.declaration

  const allIssues = useMemo(() => validateAll(data, files), [data, files])
  const stepIndex = STEP_ORDER.indexOf(step)

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0]
    if (!first) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`f-${first}`) ?? document.querySelector<HTMLElement>(`[data-field="f-${first}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(el as HTMLElement | null)?.focus?.({ preventScroll: true })
    })
  }

  const next = () => {
    const errs = { ...validateStep(step, data, files), ...Object.fromEntries(Object.entries(serverErrors).filter(([k]) => stepOfField(k) === step)) }
    setAttempted((a) => new Set(a).add(step))
    if (Object.keys(errs).length) {
      setTouched((t) => new Set([...t, ...Object.keys(errs)]))
      return focusFirstError(errs)
    }
    flush()
    if (returnToReview) {
      setReturnToReview(false)
      goTo('review')
    } else goTo(STEP_ORDER[stepIndex + 1])
  }

  const back = () => {
    if (stepIndex > 0) goTo(STEP_ORDER[stepIndex - 1])
  }

  const submit = async () => {
    setAttempted((a) => new Set(a).add('review'))
    setSubmitError(null)
    const firstBad = STEP_ORDER.find((s) => Object.keys(allIssues[s]).length)
    if (firstBad) {
      setAttempted((a) => new Set(a).add(firstBad))
      setTouched((t) => new Set([...t, ...Object.keys(allIssues[firstBad])]))
      setReturnToReview(true)
      toast({ message: 'A few answers need fixing first. We’ve taken you there.' })
      goTo(firstBad)
      return
    }
    const reviewErrs = validateStep('review', data, files)
    if (!captchaAnswer.trim()) {
      setCaptchaError('Enter the security code.')
      return focusFirstError({ captcha: 'x' })
    }
    if (Object.keys(reviewErrs).length) return focusFirstError(reviewErrs)
    if (!captcha) return

    flush()
    setSubmitting(true)
    setCaptchaError(undefined)
    try {
      const res = await api.submit(data, files, { token: captcha.token, answer: captchaAnswer })
      if (!res.ok) {
        setSubmitError(res.message)
        setSubmitActions(res.actions ?? [])
        const fe = { ...(res.fieldErrors ?? {}) }
        if (fe.captcha) {
          setCaptchaError(fe.captcha)
          delete fe.captcha
        }
        setServerErrors(fe)
        if (res.captcha) {
          setCaptcha(res.captcha)
          setCaptchaAnswer('')
        }
        const target = Object.keys(fe)[0]
        if (target) {
          setReturnToReview(true)
          goTo(stepOfField(target))
          focusFirstError(fe)
        } else {
          setTimeout(() => document.getElementById('submit-error-inline')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
        }
        return
      }
      const a: Ack = { referenceNo: res.referenceNo, submittedAt: res.submittedAt, irdDateTime: res.irdDateTime, irdHtml: res.irdHtml, demo: res.demo, data, files }
      saveAck(a)
      clearDraft()
      deleteFilesExcept([]).catch(() => {})
      setAck(a)
      history.replaceState(null, '', location.pathname)
      window.scrollTo({ top: 0 })
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (submitting) return
    if (step === 'review') submit()
    else next()
  }

  // ---- start over with undo ---------------------------------------------------
  const startOver = () => {
    confirmRef.current?.close()
    const stash = { ...latest.current }
    window.clearTimeout(saveTimer.current)
    clearDraft()
    setData(EMPTY_FORM)
    setFiles([])
    setMaxStep(0)
    setTouched(new Set())
    setAttempted(new Set())
    setServerErrors({})
    setReturnToReview(false)
    setSubmitError(null)
    setSaveState('idle')
    setSavedAt(null)
    goTo('type')
    let undone = false
    toast(
      {
        message: 'Form cleared.',
        action: {
          label: 'Undo',
          run: () => {
            undone = true
            setData(stash.data)
            setFiles(stash.files)
            setMaxStep(stash.maxStep)
            goTo(stash.step)
          },
        },
      },
      10000,
    )
    // Uploaded files stay on the device until the undo window closes.
    setTimeout(() => {
      if (!undone) deleteFilesExcept(latest.current.files.map((f) => f.id)).catch(() => {})
    }, 10500)
  }

  const newRegistration = () => {
    clearAck()
    setAck(null)
    setData(EMPTY_FORM)
    setFiles([])
    setMaxStep(0)
    setTouched(new Set())
    setAttempted(new Set())
    setCaptcha(null)
    setStep('type')
    history.replaceState({ step: 'type' }, '', '#type')
  }

  // ---------------------------------------------------------------------------
  const meta = STEP_META[step]
  const errorList = attempted.has(step) ? Object.entries(visibleErrors).filter(([k]) => k !== 'captcha') : []
  const progress = Math.round(((stepIndex + (step === 'review' ? 1 : 0)) / STEP_ORDER.length) * 100)

  return (
    <div className="min-h-dvh">
      <Header />
      {isMock && (
        <div className="no-print border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-900/60 dark:text-amber-100">
          DEMO MODE — nothing is sent to IRD. Reference numbers are fake. Start with <code className="font-mono">VITE_API_MODE=legacy</code> to connect to IRD.
        </div>
      )}
      {!isMock && (
        <div className="no-print border-b border-emerald-300 bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
          LIVE — connected to IRD. {import.meta.env.VITE_LEGACY_FINAL === 'true' ? 'Final submission ENABLED: submitting creates a real registration.' : 'Dry run: IRD validates, nothing is registered.'}
        </div>
      )}
      {!online && (
        <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <WifiOff className="mr-1.5 inline size-4" /> You’re offline. Keep going — everything is saved on this device. You can submit when you’re back online.
        </div>
      )}

      {ack ? (
        <main className="px-4 py-8 sm:py-12">
          <Acknowledgement ack={ack} onNew={newRegistration} />
        </main>
      ) : (
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:py-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
          {/* Sidebar stepper */}
          <aside className="no-print lg:sticky lg:top-6 lg:self-start">
            {/* Mobile progress */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Step {stepIndex + 1} of {STEP_ORDER.length} · {meta.nav}
                </span>
                <SaveIndicator state={saveState} savedAt={savedAt} now={now} />
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
                <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
              </div>
            </div>

            <nav aria-label="Registration steps" className="hidden lg:block">
              <ol className="relative space-y-1">
                {STEP_ORDER.map((s, i) => {
                  const reachable = i <= maxStep
                  const issues = Object.keys(allIssues[s]).length
                  const done = reachable && i < maxStep && !issues && s !== step
                  const warn = reachable && issues > 0 && s !== step && i < maxStep
                  const current = s === step
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={!reachable}
                        onClick={() => goTo(s)}
                        aria-current={current ? 'step' : undefined}
                        className={cx(
                          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                          current ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-800' : 'text-slate-600 dark:text-slate-400',
                          reachable && !current && 'hover:bg-white/70 hover:text-slate-900 dark:hover:bg-slate-900/60 dark:hover:text-slate-100',
                          !reachable && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span
                          className={cx(
                            'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition',
                            current && 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950',
                            done && 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
                            warn && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                            !current && !done && !warn && 'bg-slate-200 text-slate-500 dark:bg-slate-800',
                          )}
                        >
                          {done ? <Check className="size-3.5" strokeWidth={3} /> : warn ? '!' : i + 1}
                        </span>
                        <span className="flex-1">{STEP_META[s].nav}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
                <SaveIndicator state={saveState} savedAt={savedAt} now={now} block />
                <p className="text-slate-500 dark:text-slate-400">You can close this page at any time and pick up where you left off on this device.</p>
                {hasContent(data, files) && (
                  <button type="button" onClick={() => confirmRef.current?.showModal()} className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-red-600 dark:text-slate-400">
                    <RotateCcw className="size-3.5" /> Start over
                  </button>
                )}
              </div>
            </nav>
          </aside>

          {/* Main card */}
          <FormContext.Provider value={ctx}>
            <form onSubmit={onSubmit} noValidate className="min-w-0">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-5 py-6 sm:px-8 dark:border-slate-800">
                  <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase dark:text-brand-300">
                    Step {stepIndex + 1} of {STEP_ORDER.length}
                  </p>
                  <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold tracking-tight text-slate-900 outline-none sm:text-[28px] dark:text-white">
                    {meta.title(data)}
                  </h1>
                  <p className="mt-1.5 text-slate-500 dark:text-slate-400">{meta.desc}</p>
                </div>

                <div key={step} className="space-y-6 px-5 py-6 animate-slide-up sm:px-8 sm:py-8">
                  {returnToReview && step !== 'review' && (
                    <Callout tone="info">
                      You’re changing an answer. Press <strong>Save and return to review</strong> when you’re done.
                    </Callout>
                  )}
                  {submitError && step !== 'review' && Object.keys(serverErrors).length > 0 && (
                    <div id="submit-error" tabIndex={-1} role="alert" className="outline-none">
                    <Callout tone="error" icon={<AlertTriangle className="size-4" />}>
                      <p className="font-semibold">We couldn’t submit your application</p>
                      <p className="mt-0.5">{submitError}</p>
                      <ActionLinks actions={submitActions} />
                    </Callout>
                    </div>
                  )}
                  {errorList.length > 0 && (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        {errorList.length === 1 ? 'Please fix 1 thing to continue' : `Please fix ${errorList.length} things to continue`}
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
                        {errorList.map(([k, v]) => (
                          <li key={k}>
                            <a href={`#f-${k}`} onClick={(e) => (e.preventDefault(), focusFirstError({ [k]: v }))} className="underline underline-offset-2 hover:no-underline">
                              {v}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step === 'type' && <StepType />}
                  {step === 'details' && <StepDetails />}
                  {step === 'contact' && <StepContact />}
                  {step === 'purpose' && <StepPurpose />}
                  {step === 'review' && (
                    <StepReview
                      issues={allIssues}
                      goTo={(s) => {
                        setReturnToReview(true)
                        goTo(s)
                      }}
                      captcha={captcha}
                      captchaAnswer={captchaAnswer}
                      setCaptchaAnswer={(v) => {
                        setCaptchaAnswer(v)
                        setCaptchaError(undefined)
                      }}
                      refreshCaptcha={refreshCaptcha}
                      captchaError={captchaError}
                      captchaLoading={captchaLoading}
                      submitError={submitError}
                      submitActions={submitActions}
                    />
                  )}
                </div>

                {/* Footer actions */}
                <div className="no-print sticky bottom-0 z-20 flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white/90 px-5 py-4 backdrop-blur sm:px-8 dark:border-slate-800 dark:bg-slate-900/90">
                  <div>
                    {stepIndex > 0 && (
                      <Button type="button" variant="ghost" onClick={back}>
                        <ArrowLeft className="size-4" /> Back
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:block lg:hidden">
                      <SaveIndicator state={saveState} savedAt={savedAt} now={now} />
                    </span>
                    {step === 'review' ? (
                      <Button type="submit" loading={submitting} disabled={!online}>
                        {submitting ? 'Submitting…' : 'Submit application'} {!submitting && <Send className="size-4" />}
                      </Button>
                    ) : (
                      <Button type="submit">
                        {returnToReview ? 'Save and return to review' : 'Continue'} <ArrowRight className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm lg:hidden">
                {hasContent(data, files) && (
                  <button type="button" onClick={() => confirmRef.current?.showModal()} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-red-600">
                    <RotateCcw className="size-3.5" /> Start over
                  </button>
                )}
              </div>
              {!isMock && (
                <p className="mt-6 text-center text-xs font-medium text-amber-600">
                  Live mode — connected to IRD. {import.meta.env.VITE_LEGACY_FINAL === 'true' ? 'Final submission is ENABLED.' : 'Dry run: stops after IRD validation, nothing is registered.'}
                </p>
              )}
              {isMock && (
                <p className="mt-6 text-center text-xs text-slate-400">
                  Demo mode — submissions are simulated in your browser. Try NIC <code>200000000001</code> to see a server-side error.
                </p>
              )}
            </form>
          </FormContext.Provider>
        </main>
      )}

      {/* Confirm start over */}
      <dialog
        ref={confirmRef}
        className="m-auto w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.target === confirmRef.current && confirmRef.current?.close()}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold">Start over?</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">This clears everything you’ve entered and any files you’ve attached. You’ll have a few seconds to undo.</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => confirmRef.current?.close()} autoFocus>
              Keep my answers
            </Button>
            <Button variant="danger" onClick={startOver}>
              Clear form
            </Button>
          </div>
        </div>
      </dialog>

      {/* Toasts */}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-lg items-center gap-4 rounded-xl px-4 py-3 text-sm shadow-xl animate-slide-up',
              t.tone === 'error' ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
            )}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 font-semibold text-brand-300 hover:underline dark:text-brand-700"
                onClick={() => {
                  t.action!.run()
                  setToasts((ts) => ts.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="no-print border-b border-brand-900/20 bg-brand-800 text-white dark:bg-brand-900">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5">
        <span className="grid size-9 place-items-center rounded-lg bg-white/10 font-bold ring-1 ring-white/20">TIN</span>
        <div className="leading-tight">
          <p className="font-semibold">Taxpayer Registration</p>
          <p className="text-xs text-brand-100/80">Inland Revenue · e-Services</p>
        </div>
      </div>
    </header>
  )
}

function SaveIndicator({ state, savedAt, now, block }: { state: string; savedAt: number | null; now: number; block?: boolean }) {
  if (state === 'idle') return block ? <p className="flex items-center gap-1.5 text-slate-500"><CloudCheck className="size-4" /> Progress saves automatically</p> : null
  return (
    <span className={cx('items-center gap-1.5 text-xs', block ? 'flex text-sm' : 'inline-flex', state === 'error' ? 'text-red-600' : 'text-slate-500 dark:text-slate-400')} aria-live="polite">
      {state === 'saving' && (<><Loader2 className="size-3.5 animate-spin" /> Saving…</>)}
      {state === 'saved' && savedAt && (<><CloudCheck className="size-4 text-emerald-600" /> Saved {relTime(savedAt, now)}</>)}
      {state === 'error' && (<><CloudOff className="size-4" /> Couldn’t save on this device</>)}
    </span>
  )
}
