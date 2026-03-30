import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

function getTgId(req: NextRequest): number | null {
  const auth = req.headers.get('authorization')
  const token = auth?.split(' ')[1]
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    return payload.id || payload.tg_id || null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    const tgUserId = getTgId(req)
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim()

    await pool.query(
      `INSERT INTO site_events (event_type, path, tg_user_id, ip) VALUES ($1, $2, $3, $4)`,
      ['pv', path, tgUserId, ip]
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
