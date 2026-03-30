import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

function auth(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    return token ? jwt.verify(token, JWT_SECRET) : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  
  const r = await pool.query('SELECT id, email FROM admin_users LIMIT 1')
  if (!r.rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
  
  // Ensure site_settings table exists and has defaults
  await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`)
  await pool.query(`INSERT INTO site_settings (key, value) VALUES ('search_duration_min', '10'), ('search_duration_max', '20') ON CONFLICT (key) DO NOTHING`)
  
  const settingsRows = await pool.query('SELECT key, value FROM site_settings')
  const settings = Object.fromEntries(settingsRows.rows.map(r => [r.key, r.value]))

  // 统计过去 5 分钟内的活跃人数
  const onlineRes = await pool.query(
    `SELECT COUNT(*)::int as count FROM active_sessions WHERE last_seen > NOW() - INTERVAL '5 minutes'`
  )
  
  return NextResponse.json({ email: r.rows[0].email, settings, online_count: onlineRes.rows[0]?.count || 0 })
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  
  const { currentPassword, newUsername, newPassword, settings } = await req.json()
  if (!currentPassword) return NextResponse.json({ error: '请输入当前密码' }, { status: 400 })

  const r = await pool.query('SELECT * FROM admin_users LIMIT 1')
  if (!r.rows.length) return NextResponse.json({ error: '管理员不存在' }, { status: 404 })
  const admin = r.rows[0]

  const ok = await bcrypt.compare(currentPassword, admin.password_hash)
  if (!ok) return NextResponse.json({ error: '当前密码错误' }, { status: 403 })

  if (newUsername) {
    await pool.query('UPDATE admin_users SET email = $1 WHERE id = $2', [newUsername, admin.id])
  }
  if (newPassword) {
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, admin.id])
  }
  
  // Update site settings
  if (settings && typeof settings === 'object') {
    for (const [key, value] of Object.entries(settings)) {
      await pool.query('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value as string])
    }
  }

  return NextResponse.json({ ok: true })
}
