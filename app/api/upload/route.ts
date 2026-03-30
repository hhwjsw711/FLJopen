import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB（前端已压缩，实际很小）
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: 'too_large' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg'
    const filename = `${randomUUID()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'boom')
    await writeFile(path.join(uploadDir, filename), buffer)

    return NextResponse.json({ url: `/uploads/boom/${filename}` })
  } catch (e) {
    console.error('upload error', e)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
