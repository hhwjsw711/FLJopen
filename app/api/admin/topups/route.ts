import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

function auth(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    return token ? jwt.verify(token, process.env.JWT_SECRET || 'process.env.JWT_SECRET') : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { rows } = await pool.query(
    `SELECT t.*, u.username, u.first_name
     FROM flj_topups t
     LEFT JOIN users u ON u.telegram_id = t.tg_user_id
     ORDER BY t.created_at DESC`
  )
  return NextResponse.json({ rows })
}
