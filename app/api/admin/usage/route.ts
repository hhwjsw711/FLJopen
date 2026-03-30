import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN
const XAI_API_KEY = process.env.XAI_API_KEY

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // 1. JWT Auth
  const auth = req.headers.get('authorization')
  const token = auth?.split(' ')[1]
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid Token' }, { status: 401 })
  }

  const results: any = {
    twitter: { ok: false, data: null },
    xai: { ok: false, data: null }
  }

  // 2. Fetch Twitter Usage
  if (TWITTER_BEARER_TOKEN) {
    try {
      const res = await fetch('https://api.twitter.com/2/usage/tweets', {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
      })
      if (res.ok) {
        results.twitter.ok = true
        results.twitter.data = await res.json()
      } else {
        const err = await res.text()
        results.twitter.error = err
      }
    } catch (e: any) {
      results.twitter.error = e.message
    }
  }

  // 3. Test xAI Connectivity (Checking models is a good proxy for valid key)
  if (XAI_API_KEY) {
    try {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${XAI_API_KEY}` }
      })
      if (res.ok) {
        results.xai.ok = true
        const models = await res.json()
        results.xai.data = { status: 'Key Valid', model_count: models.models?.length || 0 }
      } else {
        results.xai.error = await res.text()
      }
    } catch (e: any) {
      results.xai.error = e.message
    }
  }

  return NextResponse.json(results)
}
