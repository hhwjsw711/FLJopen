import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'flj_admin_secret_2026'

function auth(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    return token ? jwt.verify(token, JWT_SECRET) : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  // 单条查询（编辑弹窗用）
  if (id) {
    const result = await pool.query('SELECT * FROM girls WHERE id = $1', [id])
    return NextResponse.json(result.rows[0] || null)
  }
  const sql = status
    ? 'SELECT * FROM girls WHERE status = $1 ORDER BY created_at DESC'
    : 'SELECT * FROM girls ORDER BY created_at DESC'
  const result = await pool.query(sql, status ? [status] : [])
  return NextResponse.json(result.rows)
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, status, is_promoted } = await req.json()
  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  if (status !== undefined) { vals.push(status); sets.push(`status = $${vals.length}`) }
  if (is_promoted !== undefined) { vals.push(is_promoted); sets.push(`is_promoted = $${vals.length}`) }
  vals.push(id)
  await pool.query(`UPDATE girls SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await pool.query('DELETE FROM girls WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}
