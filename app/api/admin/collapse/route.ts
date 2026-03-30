import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try { jwt.verify(token, JWT_SECRET) } catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const { comment_id, collapsed } = await req.json()
  if (!comment_id) return NextResponse.json({ error: 'missing comment_id' }, { status: 400 })

  await pool.query('UPDATE comments SET is_collapsed = $1 WHERE id = $2', [!!collapsed, comment_id])
  return NextResponse.json({ ok: true })
}
