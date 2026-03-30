import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'flj_admin_secret_2026'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  const result = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email])
  const user = result.rows[0]
  if (!user || !await bcrypt.compare(password, user.password_hash))
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
  return NextResponse.json({ token })
}
