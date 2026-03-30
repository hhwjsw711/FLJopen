import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM girls) as total_girls,
        (SELECT COUNT(*) FROM girls WHERE score >= 60) as trusted_count,
        (SELECT COUNT(*) FROM girls WHERE cached_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo') as today_new,
        (SELECT COUNT(*) FROM site_events WHERE event_type = 'pv' AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo') as today_pv
    `)
    return NextResponse.json(res.rows[0], { headers: NO_CACHE })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
