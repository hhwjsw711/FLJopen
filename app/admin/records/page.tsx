'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Girl {
  id: string; twitter_username: string; display_name: string; bio: string
  score: number; account_language: string; is_fushi: boolean; is_offline: boolean
  has_threshold: boolean; active_cities: string[]; negative_tags: string[]
  positive_tags: string[]; user_eval: string; likes: number; dislikes: number
  complaint_examples: string[]; positive_examples: string[]
  cached_at: string; search_count: number
}

export default function RecordsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Girl[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Girl | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/records').then(r => r.json()).then(d => { setRows(d); setLoading(false) })
  }, [])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    await fetch('/api/admin/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing)
    })
    setRows(rows.map(r => r.id === editing.id ? editing : r))
    setEditing(null)
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('确认删除？')) return
    await fetch(`/api/admin/records?id=${id}`, { method: 'DELETE' })
    setRows(rows.filter(r => r.id !== id))
  }

  const filtered = rows.filter(r =>
    r.twitter_username.includes(search) || (r.display_name || '').includes(search)
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e10', color: 'white', padding: '24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => router.push('/admin')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>← 返回</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📋 账号数据库</h1>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{rows.length} 条记录</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索用户名..."
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: 'white', outline: 'none', width: 200 }} />
        </div>

        {loading ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>加载中...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['用户名','昵称','分数','语言','风俗','线下','门槛','城市','负面标签','正面标签','好用','无用','缓存时间','操作'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <a href={`/verify/${r.twitter_username}`} target="_blank" style={{ color: '#f43f8a', textDecoration: 'none' }}>@{r.twitter_username}</a>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)' }}>{r.display_name || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: r.score >= 62 ? '#4ade80' : r.score >= 38 ? '#facc15' : '#f87171', fontWeight: 700 }}>{r.score}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)' }}>{r.account_language || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.is_fushi ? '✅' : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.is_offline ? '✅' : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.has_threshold ? '⚠️' : '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{(r.active_cities || []).join(', ') || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {(r.negative_tags || []).map(t => <span key={t} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 4, padding: '1px 6px', fontSize: 11, marginRight: 4 }}>{t}</span>)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {(r.positive_tags || []).map(t => <span key={t} style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', borderRadius: 4, padding: '1px 6px', fontSize: 11, marginRight: 4 }}>{t}</span>)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#4ade80' }}>{r.likes}</td>
                    <td style={{ padding: '8px 12px', color: '#f87171' }}>{r.dislikes}</td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{r.cached_at ? new Date(r.cached_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditing({ ...r })}
                        style={{ background: 'rgba(102,126,234,0.2)', border: '1px solid rgba(102,126,234,0.3)', color: '#a7b3ff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', marginRight: 6, fontSize: 12 }}>编辑</button>
                      <button onClick={() => del(r.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>编辑 @{editing.twitter_username}</h2>
            
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>综合得分</label>
                <input type="number" value={editing.score} onChange={e => setEditing({ ...editing, score: +e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>账户评价</label>
                <textarea rows={4} value={editing.user_eval || ''} onChange={e => setEditing({ ...editing, user_eval: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>有用数</label>
                  <input type="number" value={editing.likes} onChange={e => setEditing({ ...editing, likes: +e.target.value })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>无用数</label>
                  <input type="number" value={editing.dislikes} onChange={e => setEditing({ ...editing, dislikes: +e.target.value })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>负面标签（逗号分隔，如 stolen_photo,scam）</label>
                <input value={(editing.negative_tags || []).join(',')} onChange={e => setEditing({ ...editing, negative_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block', marginBottom: 6 }}>正面标签（逗号分隔）</label>
                <input value={(editing.positive_tags || []).join(',')} onChange={e => setEditing({ ...editing, positive_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[['is_fushi','風俗業者'],['is_offline','可线下'],['has_threshold','有门槛费']].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!(editing as any)[key]} onChange={e => setEditing({ ...editing, [key]: e.target.checked } as any)} />
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>取消</button>
              <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)', border: 'none', color: 'white', borderRadius: 8, padding: '8px 24px', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
