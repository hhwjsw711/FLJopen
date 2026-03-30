import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.TG_JWT_SECRET!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  if (!username) return NextResponse.json([], { status: 400 })
  try {
    const res = await pool.query(
      `SELECT * FROM comments WHERE LOWER(twitter_username) = LOWER($1) ORDER BY created_at DESC`,
      [username]
    )
    return NextResponse.json(res.rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  try {
    if (!JWT_SECRET) throw new Error('Secret missing')
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { twitter_username, content } = await req.json()
    if (!twitter_username || !content || content.trim().length < 2) {
      return NextResponse.json({ error: '内容太短' }, { status: 400 })
    }
    const res = await pool.query(
      `INSERT INTO comments (twitter_username, user_id, user_name, user_avatar, content)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [twitter_username, decoded.id, decoded.first_name, decoded.photo_url, content.trim()]
    )
    return NextResponse.json({ ok: true, comment: res.rows[0] })
  } catch (e: any) {
    console.error('Comment POST error:', e.message)
    return NextResponse.json({ error: `验证失败: ${e.message}` }, { status: 401 })
  }
}
