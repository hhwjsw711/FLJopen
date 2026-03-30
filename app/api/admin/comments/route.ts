import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

// 后台获取所有评论
export async function GET() {
  try {
    const res = await pool.query(
      `SELECT * FROM comments ORDER BY created_at DESC LIMIT 500`
    )
    return NextResponse.json(res.rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 删除评论
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    await pool.query('DELETE FROM comments WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
