import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.split(' ')[1]
  let identifier = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown'

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any
      if (payload.id || payload.tg_id) identifier = `user:${payload.id || payload.tg_id}`
    } catch {}
  }

  // Upsert 活动记录
  await pool.query(
    `INSERT INTO active_sessions (id, last_seen) VALUES ($1, NOW())
     ON CONFLICT (id) DO UPDATE SET last_seen = NOW()`,
    [identifier]
  )

  return NextResponse.json({ ok: true })
}
