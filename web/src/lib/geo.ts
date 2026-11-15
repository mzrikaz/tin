// Sri Lankan administrative divisions with IRD (RAMIS) codes.
// Source: /Registration/TPRCommon/GetDistrictByProvince, GetSecretariatByDistrict,
// GetGramaBySecretariat on eservices.ird.gov.lk (fetched 2026-11-15).
// Loaded lazily as its own chunk (~14k GN divisions).
import type { Option } from './types'

export interface GeoDs { code: string; name: string; gn: [string, string][] }
export interface GeoDistrict { code: string; name: string; divisions: GeoDs[] }
export interface GeoProvince { code: string; name: string; districts: GeoDistrict[] }

let cache: GeoProvince[] | null = null
let promise: Promise<GeoProvince[]> | null = null
const index = new Map<string, string>() // `${level}:${code}` -> name

export function loadGeo(): Promise<GeoProvince[]> {
  if (cache) return Promise.resolve(cache)
  promise ??= import('../data/geo-lk.json').then((m) => {
    cache = m.default as GeoProvince[]
    for (const p of cache) {
      index.set(`p:${p.code}`, p.name)
      for (const d of p.districts) {
        index.set(`d:${d.code}`, d.name)
        for (const s of d.divisions) {
          index.set(`s:${s.code}`, s.name)
          for (const [c, n] of s.gn) index.set(`g:${c}`, n)
        }
      }
    }
    return cache
  })
  return promise
}

export const geoReady = () => cache !== null

const title = (s: string) => s.toLowerCase().replace(/(^|[\s(\-&/])([a-z])/g, (_, a, b) => a + b.toUpperCase())

/** Human label for a stored code; falls back to the raw value. */
export function geoName(level: 'p' | 'd' | 's' | 'g', code: string): string {
  if (!code) return ''
  const n = index.get(`${level}:${code}`)
  return n ? title(n) : code
}

const opt = (code: string, name: string): Option => ({ value: code, label: title(name) })
const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label, undefined, { numeric: true })

export const provinceOptions = (g: GeoProvince[]) => g.map((p) => opt(p.code, p.name)).sort(byLabel)
export const districtOptions = (g: GeoProvince[], p: string) =>
  (g.find((x) => x.code === p)?.districts ?? []).map((d) => opt(d.code, d.name)).sort(byLabel)

function findDistrict(g: GeoProvince[], d: string) {
  for (const p of g) for (const x of p.districts) if (x.code === d) return x
}
export const dsOptions = (g: GeoProvince[], d: string) =>
  (findDistrict(g, d)?.divisions ?? []).map((s) => opt(s.code, s.name)).sort(byLabel)
export function gnOptions(g: GeoProvince[], d: string, s: string) {
  const ds = findDistrict(g, d)?.divisions.find((x) => x.code === s)
  return (ds?.gn ?? []).map(([c, n]) => opt(c, n)).sort(byLabel)
}

/** True if the four stored codes form a valid chain (used to drop stale drafts). */
export function isValidChain(g: GeoProvince[], p: string, d: string) {
  if (!p) return true
  const prov = g.find((x) => x.code === p)
  if (!prov) return false
  return !d || prov.districts.some((x) => x.code === d)
}
