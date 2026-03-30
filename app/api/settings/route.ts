import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const r = await pool.query('SELECT key, value FROM site_settings')
    const settings = Object.fromEntries(r.rows.map(row => [row.key, row.value]))
    return NextResponse.json(settings)
  } catch (err) {
    // Fallback defaults
    return NextResponse.json({
      search_duration_min: '10',
      search_duration_max: '20'
    })
  }
}
