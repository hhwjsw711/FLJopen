import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    jwt.verify(token, JWT_SECRET)

    const { user_id, is_moderator } = await req.json()
    if (!user_id) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

    await pool.query('UPDATE users SET is_moderator = $1 WHERE id = $2', [!!is_moderator, user_id])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
