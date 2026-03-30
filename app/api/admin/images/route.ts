import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

function verifyAdmin(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    if (!token) return false
    jwt.verify(token, JWT_SECRET)
    return true
  } catch { return false }
}

// GET — 获取待审核图片列表
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { rows } = await pool.query(`
    SELECT id, content, image_urls, images_status, twitter_username, created_at, user_tier
    FROM comments
    WHERE is_expose = true AND array_length(image_urls, 1) > 0
    ORDER BY CASE images_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, created_at DESC
    LIMIT 100
  `)
  return NextResponse.json({ items: rows })
}

// POST — 审核操作 { comment_id, action: 'approve'|'reject'|'delete_one', url?: string }
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { comment_id, action, url } = await req.json()
  if (!comment_id || !['approve', 'reject', 'delete_one'].includes(action)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  // 单张删除
  if (action === 'delete_one') {
    if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 })

    // 从数组中移除指定 URL
    const { rows } = await pool.query(
      `UPDATE comments
       SET image_urls = array_remove(image_urls, $1)
       WHERE id = $2
       RETURNING image_urls`,
      [url, comment_id]
    )
    const remaining = rows[0]?.image_urls ?? []
    // 如果全删完了，状态改为 none；否则保持 approved
    const newStatus = remaining.length === 0 ? 'none' : 'approved'
    await pool.query(`UPDATE comments SET images_status = $1 WHERE id = $2`, [newStatus, comment_id])

    // 删除服务器上的文件
    try {
      const filename = url.split('/').pop()
      if (filename) {
        const fs = await import('fs/promises')
        const path = await import('path')
        const filePath = path.join(process.cwd(), 'public', 'uploads', 'boom', filename)
        await fs.unlink(filePath)
      }
    } catch { /* 文件不存在也没关系 */ }

    return NextResponse.json({ ok: true, remaining_count: remaining.length })
  }

  const status = action === 'approve' ? 'approved' : 'rejected'
  await pool.query(`UPDATE comments SET images_status = $1 WHERE id = $2`, [status, comment_id])
  return NextResponse.json({ ok: true, status })
}
