import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await pool.query(
      `SELECT u.*, 
        COALESCE(url.count, 0) as today_count,
        url.last_search_at
       FROM users u
       LEFT JOIN user_rate_limits url ON url.tg_user_id = u.id AND url.date = CURRENT_DATE
       ORDER BY u.last_login DESC LIMIT 1000`
    )
    return NextResponse.json(res.rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
