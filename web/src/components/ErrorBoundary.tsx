import { Component, type ReactNode } from 'react'

/** Last line of defence: a render bug must never cost the user their answers (they stay in localStorage). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[TIN] render error', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your answers are saved on this device. Reloading usually fixes it.</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-6 rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800"
        >
          Reload
        </button>
      </div>
    )
  }
}
