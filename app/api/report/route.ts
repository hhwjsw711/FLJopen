import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { twitter_username, reason } = await req.json()
    if (!twitter_username || !reason?.trim()) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    if (reason.trim().length > 200) {
      return NextResponse.json({ error: 'reason too long' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const tgUser = req.headers.get('x-tg-user-id') || null

    // 同一 IP 对同一账号限制：24小时内最多3次
    const recent = await pool.query(
      `SELECT COUNT(*) FROM reports WHERE twitter_username=$1 AND reporter_ip=$2 AND created_at > NOW() - INTERVAL '24 hours'`,
      [twitter_username, ip]
    )
    if (parseInt(recent.rows[0].count) >= 3) {
      return NextResponse.json({ error: 'too_many_reports' }, { status: 429 })
    }

    await pool.query(
      `INSERT INTO reports (twitter_username, reason, reporter_ip, reporter_tg_id) VALUES ($1, $2, $3, $4)`,
      [twitter_username.toLowerCase(), reason.trim(), ip, tgUser]
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
