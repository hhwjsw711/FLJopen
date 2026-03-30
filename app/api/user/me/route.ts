import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'
import { getTgUserRank } from '@/lib/rank'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const payload = jwt.verify(token, JWT_SECRET) as any
    const res = await pool.query(
      'SELECT points, is_member, is_moderator FROM users WHERE telegram_id = $1',
      [payload.id]
    )
    if (!res.rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const { points, is_member, is_moderator } = res.rows[0]
    const rank = is_member ? '天龙人' : getTgUserRank(points)

    return NextResponse.json({ points, is_member, is_moderator: !!is_moderator, rank })
  } catch {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }
}
