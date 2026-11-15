import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// IRD's ASP.NET backend only accepts same-origin requests, so the app talks to it through
// this proxy (dev server and `vite preview`). LEGACY_ORIGIN comes from .env.
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // The Pages build has no backend, so no proxy.
  const origin = mode === 'pages' ? undefined : env.LEGACY_ORIGIN
  const proxy: Record<string, ProxyOptions> | undefined = origin
    ? Object.fromEntries(
        ['/Registration', '/Common', '/Content', '/Scripts', '/bundles', '/DefaultCaptcha'].map((p) => [
          p,
          {
            target: origin,
            changeOrigin: true,
            secure: true,
            cookieDomainRewrite: '',
            headers: { Origin: origin, Referer: `${origin}/registration/tinregistration/showrequestheader` },
          },
        ]),
      )
    : undefined
  return {
    // Relative asset paths so the build works under any GitHub Pages repo path (/<repo>/).
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss()],
    server: { port: 5180, strictPort: true, proxy },
    preview: { port: 5180, strictPort: true, proxy },
  }
})
