# TIN Registration (React + Vite)

Rebuild of the legacy IRD TIN registration form (`../form.html`, `../inline-script-*.js`, `../registration.js`).

```bash
npm install
npm run dev        # http://localhost:5180 — LIVE: talks to eservices.ird.gov.lk, Submit creates a REAL registration
npm run build && npm run preview   # same, from the production build (port 5180, same IRD proxy)
```

Defaults live in `.env`. Override per run:
```bash
VITE_API_MODE=mock npm run dev        # demo — nothing sent, DEMO-xxxx reference numbers
VITE_LEGACY_FINAL=false npm run dev   # live dry run — IRD validates, nothing is registered
```
A coloured banner at the top of every page always shows which mode you are in.

## GitHub Pages (static demo)
```bash
npm run build:pages     # → dist/, relative paths, works under https://<user>.github.io/<repo>/
```
`.github/workflows/pages.yml` builds and deploys automatically on every push to `main` that touches `web/`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

The Pages build is always **demo mode** (`.env.pages`): GitHub Pages is static hosting, and IRD's backend has no
CORS and needs same-origin session cookies, so live submission is only possible through the dev/preview proxy.
The page shows an "Unofficial prototype" banner.

## Never lose data
- Every keystroke autosaves to `localStorage` (debounced 400 ms, flushed on tab hide / close).
- Uploaded files are stored in IndexedDB, so they survive reloads too.
- On return: draft restored automatically with a "Welcome back" toast.
- Server errors (wrong captcha, duplicate NIC…) never clear the form; only the captcha refreshes.
- Browser Back/Forward moves between steps (`#type`, `#details`, …) instead of leaving the page.
- "Start over" asks for confirmation and offers Undo for 10 s. Removing a file also offers Undo.
- Offline banner; you can keep filling in and submit later.
- Changing taxpayer type keeps the other type's answers in the draft (only relevant fields are sent).

## API modes
- `legacy` (default) — proxies `/Registration`, `/Common`, `/DefaultCaptcha`… to IRD and runs
  CreateRegistrationType → SaveToShowSummaryRequest → SaveRequest. Verified live up to SaveToShowSummaryRequest
  (IRD returned "Applicant has been registered in IRD." for an existing NIC). SaveRequest is not yet verified.
- `mock` — everything simulated in-browser. NIC `200000000001` demos a server-side field error.

## Real IRD data (scraped 2026-11-15 from eservices.ird.gov.lk)
- `src/data/geo-lk.json` — 9 provinces, 25 districts, 332 DS divisions, 13,907 GN divisions with IRD codes (lazy-loaded chunk).
- `src/data/ird-lookups.json` — entity codes, titles, 254 countries, 57 banks, professions, languages, citizenship,
  resident status, 22 regional offices, 68 organisation salutations, DMS document sub-types.
- Raw captures of the INDIVIDUAL LOCAL form, lookups, child/business popups: `../ird-reference/`.
- IRD upload rules applied: PDF/JPG/JPEG/DOC/DOCX/XLS/XLSX/TXT/CSV, 10 MB per file, 20 MB total,
  no `~#%&*+:<>?/{|}` in names. PNG/WebP photos are converted to JPG automatically.

## Still to confirm / capture
- Forms for entity types other than INDIVIDUAL LOCAL (company, partnership, foreign individual, …) —
  each needs a captcha on the IRD page to load. Their field names in `legacyFields()` are marked TODO.
- Business activity code list (not on the individual form; probably on the company form).
- Date format and child/business row index format the ASP.NET model binder expects.
