'use client'
import { useState, useEffect } from 'react'
import { getLang, type Lang } from '@/lib/i18n'

const STORAGE_KEY = 'flj_byok_key'

export default function ByokPage() {
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [lang] = useState<Lang>(() => getLang())

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(saved)
    setKeyInput(saved)
    if (saved) setKeySaved(true)
  }, [])

  function saveKey() {
    const k = keyInput.trim()
    if (!k.startsWith('process.env.XAI_API_KEY')) { setError('API Key 必须以 process.env.XAI_API_KEY 开头'); return }
    localStorage.setItem(STORAGE_KEY, k)
    setApiKey(k)
    setKeySaved(true)
    setError('')
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey(''); setKeyInput(''); setKeySaved(false)
  }

  async function handleSearch() {
    const u = username.replace('@', '').trim()
    if (!u) return
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(u)) { setError('请输入 @ 后面的英文用户名'); return }
    if (!apiKey) { setError('请先填写并保存 API Key'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/verify-byok?username=${u}&lang=${lang}`, {
        headers: { 'x-byok-key': apiKey }
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || data.error || '搜索失败'); setLoading(false); return }
      window.location.href = `/verify/${u}?lang=${lang}&source=byok`
    } catch (e: any) {
      setError(e.message || '网络错误')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e10' }}>
      {/* 顶部导航 */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f43f8a' }}>福利鉴</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>.info</span>
          </a>
          <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← 返回首页</a>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* 页面标题 */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 10 }}>🔑 自助无限检索</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 460, margin: '0 auto' }}>
            使用你自己的 xAI API Key，消耗你自己的 token<br />
            无次数限制，无需加入会员
          </p>
        </div>

        {/* 主体两栏布局 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>

          {/* 左栏：操作区 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* API Key 卡片 */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>xAI API Key</span>
                {keySaved && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                    ✓ 已保存到本地
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  style={{ flex: 1, borderRadius: 12, padding: '10px 14px', fontSize: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                  placeholder="process.env.XAI_API_KEY"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                />
                <button onClick={saveKey}
                  style={{ padding: '10px 18px', borderRadius: 12, background: '#f43f8a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
                  保存
                </button>
                {keySaved && (
                  <button onClick={clearKey}
                    style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                    清除
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, marginTop: 10, color: 'rgba(255,255,255,0.22)' }}>
                🔒 Key 仅保存在你的浏览器本地，绝不上传服务器。
                获取 Key：<a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(244,63,138,0.7)' }}>console.x.ai</a>
              </p>
            </div>

            {/* 搜索框卡片 */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>输入 X 用户名进行鉴定</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px' }}>
                  <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', fontSize: 15 }}>@</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }}
                    placeholder="输入 X 用户名"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <button onClick={handleSearch} disabled={loading || !apiKey}
                  style={{ padding: '12px 24px', borderRadius: 14, background: apiKey ? 'linear-gradient(135deg,#f43f8a,#e0368c)' : 'rgba(244,63,138,0.25)', color: apiKey ? '#fff' : 'rgba(244,63,138,0.5)', border: 'none', cursor: apiKey ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {loading ? '分析中...' : '鉴定'}
                </button>
              </div>

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #f43f8a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  正在用你的 API Key 分析中，通常需要 15-30 秒...
                </div>
              )}

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* 右栏：说明区 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 工作原理 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>📖 工作原理</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '🔑', title: '你提供 API Key', desc: 'Key 存在本地，每次搜索时随请求发送，绝不落库' },
                  { icon: '🤖', title: 'AI 分析消耗你的 token', desc: '每次新搜索约 1,500 tokens（≈ $0.03），从你的 xAI 账户扣费' },
                  { icon: '⚡', title: '有缓存则零消耗', desc: '若该账号已在数据库中，直接返回缓存，不调用任何 AI' },
                  { icon: '🗂️', title: '有缓存直接命中', desc: '已分析过的账号直接秒返回，不消耗任何 token' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 对比会员 */}
            <div style={{ background: 'rgba(244,63,138,0.05)', border: '1px solid rgba(244,63,138,0.15)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(244,63,138,0.8)', marginBottom: 12 }}>💡 与会员方案对比</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: '游客', val: '5次/天', sub: '免费' },
                  { label: '自助 Key', val: '无限制', sub: '自付 token', highlight: true },
                  { label: 'TG会员', val: '无限制', sub: '订阅频道' },
                  { label: '缓存命中', val: '所有人', sub: '0 费用', green: true },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: item.highlight ? 'rgba(244,63,138,0.1)' : item.green ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${item.highlight ? 'rgba(244,63,138,0.2)' : item.green ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: item.highlight ? '#f43f8a' : item.green ? '#4ade80' : '#fff' }}>{item.val}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
