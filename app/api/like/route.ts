import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { girl_id } = await req.json()
  return NextResponse.json({ success: true, girl_id })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const girl_id = searchParams.get('girl_id')
  const result = await pool.query('SELECT score FROM girls WHERE id = $1', [girl_id])
  return NextResponse.json({ count: result.rows[0]?.score || 0, liked: false })
}
