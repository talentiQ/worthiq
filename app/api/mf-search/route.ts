import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MFAPI_SEARCH_URL = 'https://api.mfapi.in/mf/search'
const MFAPI_FUND_URL = 'https://api.mfapi.in/mf'
const AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt'

type FundSearchResult = {
  schemeCode: string
  schemeName: string
  isinGrowth: string
  isinDivReinvestment: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''
  const schemeCode = searchParams.get('schemeCode')?.trim() || ''

  try {
    if (schemeCode) {
      const data = await fetchJson(`${MFAPI_FUND_URL}/${encodeURIComponent(schemeCode)}`)
      return NextResponse.json(data)
    }

    if (query.length < 2) {
      return NextResponse.json([])
    }

    try {
      const data = await fetchJson(`${MFAPI_SEARCH_URL}?q=${encodeURIComponent(query)}`)
      return NextResponse.json(Array.isArray(data) ? data.slice(0, 20) : [])
    } catch {
      const results = await searchAmfiNavFile(query)
      return NextResponse.json(results)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fund search failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

async function fetchJson(url: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`MF API returned HTTP ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

async function searchAmfiNavFile(query: string): Promise<FundSearchResult[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(AMFI_URL, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) throw new Error(`AMFI returned HTTP ${res.status}`)

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const seen = new Set<string>()
    const results: FundSearchResult[] = []

    for (const line of (await res.text()).split('\n')) {
      const parts = line.split(';')
      if (parts.length < 6) continue

      const schemeCode = parts[0].trim()
      const isinGrowth = parts[1].trim()
      const isinDivReinvestment = parts[2].trim()
      const schemeName = parts[3].trim()
      const haystack = schemeName.toLowerCase()

      if (!schemeCode || !schemeName || seen.has(schemeCode)) continue
      if (!terms.every(term => haystack.includes(term))) continue

      seen.add(schemeCode)
      results.push({
        schemeCode,
        schemeName,
        isinGrowth: cleanIsin(isinGrowth),
        isinDivReinvestment: cleanIsin(isinDivReinvestment),
      })

      if (results.length >= 20) break
    }

    return results
  } finally {
    clearTimeout(timeoutId)
  }
}

function cleanIsin(value: string) {
  return value && value !== 'N.A.' && value !== '-' ? value : ''
}
