import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

let citiesCache: { data: any; ts: number } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000 // 10分钟

export async function GET() {
  if (citiesCache && Date.now() - citiesCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(citiesCache.data)
  }
  try {
    const rows = await pool.query(`
      SELECT t.city, COUNT(*)::int AS count
      FROM girls,
        LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(active_cities) = 'array' THEN active_cities ELSE '[]'::jsonb END
        ) AS t(city)
      WHERE gender = 'female'
        AND cached_at IS NOT NULL
        AND active_cities IS NOT NULL
        AND active_cities::text != '[]'
        AND active_cities::text != 'null'
      GROUP BY t.city
      ORDER BY count DESC
    `)
    citiesCache = { data: rows.rows, ts: Date.now() }
    return NextResponse.json(rows.rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
