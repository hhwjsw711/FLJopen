import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

function auth(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const secret = process.env.JWT_SECRET || 'process.env.JWT_SECRET'
    return token ? jwt.verify(token, secret) : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await pool.query(
    `SELECT id, twitter_username, display_name, score, account_language,
            is_fushi, is_offline, has_threshold, active_cities, gender, is_welfare,
            negative_tags, positive_tags, user_eval, likes, dislikes,
            complaint_examples, positive_examples, cached_at, search_count,
            score_detail, is_locked, is_manual_verified,
            is_restricted, restricted_message, content_tags
     FROM girls ORDER BY updated_at DESC`
  )
  return NextResponse.json(r.rows)
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  try { 
    // 获取旧的 score_detail，以便更新它内部的特定字段而不丢失其他信息
    const old = await pool.query('SELECT score_detail FROM girls WHERE id = $1', [b.id])
    const oldSd = old.rows[0]?.score_detail || {}
    
    const newSd = {
      ...oldSd,
      complaints: b.complaints ?? 0,
      positives: b.positives ?? 0,
      is_active: b.is_active ?? true,
      engagement: b.engagement ?? 'medium',
      using_proxy: b.using_proxy ?? false,
      is_verified: b.is_verified ?? false,
      is_manual_verified: b.is_manual_verified ?? false,
      // 关键：同时同步标签到 JSONB 内部副本，彻底防止回退
      complaint_types: b.negative_tags || [],
      positive_types: b.positive_tags || [],
      complaint_examples: b.complaint_examples || [],
      positive_examples: b.positive_examples || [],
    }

    // 智能联动：如果手动清空了标签，自动把对应的布尔值也设为 false
    const hasNeg = (b.negative_tags || []).length > 0;
    const final_is_fushi = b.is_fushi && hasNeg;
    const final_is_offline = b.is_offline && hasNeg;
    const final_has_threshold = b.has_threshold && hasNeg;

    await pool.query(
    `UPDATE girls SET
       score = $1, user_eval = $2, likes = $3, dislikes = $4,
       negative_tags = $5, positive_tags = $6,
       is_fushi = $7, is_offline = $8, has_threshold = $9,
       complaint_examples = $10, positive_examples = $11,
       score_detail = $12::jsonb,
       user_eval_i18n = $13::jsonb,
       gender = $15,
       is_welfare = $16,
       is_manual_verified = $17,
       is_restricted = $18,
       restricted_message = $19,
       content_tags = $20,
       updated_at = NOW(),
       cached_at = NOW(),
       is_locked = true
     WHERE id = $14`,
    [
      b.score, b.user_eval, b.likes, b.dislikes,
      JSON.stringify(b.negative_tags || []), JSON.stringify(b.positive_tags || []),
      b.is_fushi, b.is_offline, b.has_threshold,
      JSON.stringify(b.complaint_examples || []),
      JSON.stringify(b.positive_examples || []),
      JSON.stringify(newSd),
      JSON.stringify(b.user_eval_i18n || {}),
      b.id,
      b.gender || 'unknown',
      b.is_welfare ?? true,
      b.is_manual_verified ?? false,
      b.is_restricted ?? false,
      b.restricted_message || null,
      b.content_tags || [],
    ]
  ) } catch (e: any) {
    console.error('PUT /api/admin/records error:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  await pool.query('DELETE FROM girls WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
