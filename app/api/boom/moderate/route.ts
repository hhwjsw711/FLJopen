import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const payload = jwt.verify(token, JWT_SECRET) as any

    // 验证纪检委资格
    const userRes = await pool.query(
      'SELECT is_moderator FROM users WHERE telegram_id = $1',
      [payload.id]
    )
    if (!userRes.rows.length || !userRes.rows[0].is_moderator) {
      return NextResponse.json({ error: '无权限，需要纪检委资格' }, { status: 403 })
    }

    const { comment_id } = await req.json()
    if (!comment_id) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

    // 折叠爆料（不物理删除）
    await pool.query(
      'UPDATE comments SET is_collapsed = true WHERE id = $1 AND is_expose = true',
      [comment_id]
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
