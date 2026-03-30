'use client'
import { useEffect, useState } from 'react'

interface Girl {
  id: string; twitter_username: string; display_name: string
  city: string; score: number; status: string; is_promoted: boolean
  search_count: number; score_detail: { complaints: number; positives: number }
  user_eval: string; likes: number; dislikes: number
  negative_tags: string[]; positive_tags: string[]
  is_fushi: boolean; is_offline: boolean; has_threshold: boolean
}
interface Promo {
  id: string; twitter_username: string; display_name: string; city: string; is_active: boolean
}


export default function AdminPage() {
  const [token, setToken] = useState('')
  const [pendingImages, setPendingImages] = useState<any[]>([])
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'girls' | 'records' | 'promotions' | 'users' | 'settings' | 'comments' | 'reports' | 'topups'>('dashboard')
  const [topups, setTopups] = useState<any[]>([])
  const [commentSubTab, setCommentSubTab] = useState<'list' | 'images'>('list')

  const [userFilter, setUserFilter] = useState<'all' | 'member' | 'tg_user'>('all')
  const [reports, setReports] = useState<any[]>([])
  const [reportStatus, setReportStatus] = useState<'pending' | 'resolved' | 'dismissed'>('pending')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [dashRange, setDashRange] = useState('24h')
  const [girls, setGirls] = useState<Girl[]>([])
  const [girlSearch, setGirlSearch] = useState('')
  const [girlPage, setGirlPage] = useState(1)
  const GIRLS_PER_PAGE = 100
  const [editingGirl, setEditingGirl] = useState<Girl | null>(null)
  const [savingGirl, setSavingGirl] = useState(false)
  const [evalLang, setEvalLang] = useState<'zh'|'zh-tw'|'ja'|'en'>('zh')
  const [negText, setNegText] = useState('')
  const [posText, setPosText] = useState('')
  const [promos, setPromos] = useState<Promo[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [recSearch, setRecSearch] = useState('')
  const [recPage, setRecPage] = useState(1)
  const REC_PER_PAGE = 50
  const [newPromo, setNewPromo] = useState({ twitter_username: '', city: '', display_name: '' })
  const [curPwd, setCurPwd] = useState('')
  const [newUsr, setNewUsr] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [newPwd2, setNewPwd2] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [allComments, setAllComments] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [siteSettings, setSiteSettings] = useState<any>({ search_duration_min: '10', search_duration_max: '20' })
  const [onlineCount, setOnlineCount] = useState(0)

  async function fetchUsage() {
    const res = await fetch('/api/admin/usage', { headers: { Authorization: `Bearer ${token}` } })
    const d = await res.json()
    setUsage(d)
    
    // Also fetch settings when on settings tab
    const sRes = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
    const sd = await sRes.json()
    if (sd.settings) setSiteSettings(sd.settings)
    if (sd.online_count !== undefined) setOnlineCount(sd.online_count)
  }

  async function login() {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const d = await res.json()
    if (d.token) { setToken(d.token); localStorage.setItem('flj_admin', d.token) }
    else setLoginErr(d.error || '登录失败')
  }

  useEffect(() => {
    const t = localStorage.getItem('flj_admin')
    if (t) setToken(t)
  }, [])

  async function fetchDashboard() {
    try {
      const res = await fetch(`/api/admin/dashboard?range=${dashRange}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setDashboardData(d)
    } catch {}
  }

  useEffect(() => {
    if (!token) return
    if (tab === 'dashboard') fetchDashboard()
  }, [tab, dashRange, token])

  useEffect(() => {
    if (!token) return
    fetchGirls(); fetchPromos()
    // 每 30 秒自动刷新在线人数
    const fetchOnline = async () => {
      try {
        const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
        const sd = await res.json()
        if (sd.online_count !== undefined) setOnlineCount(sd.online_count)
      } catch {}
    }
    fetchOnline()
    const timer = setInterval(fetchOnline, 30000)
    return () => clearInterval(timer)
  }, [token])

  useEffect(() => {
    if (tab === 'records' && token) fetchRecords()
    if (tab === 'comments' && token) fetchAllComments()
    if (tab === 'users' && token) fetchAllUsers()
    if (tab === 'settings' && token) fetchUsage()
    if (tab === 'reports' && token) fetchReports()
    if (tab === 'topups' && token) fetch('/api/admin/topups', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setTopups(d.rows || []))
  }, [tab, token])

  async function fetchGirls() {
    const res = await fetch('/api/admin/girls', { headers: { Authorization: `Bearer ${token}` } })
    const d = await res.json()
    if (Array.isArray(d)) setGirls(d)
  }

  async function openEditGirl(g: Girl) {
    // 打开编辑弹窗前，先从服务器拉最新数据，避免用旧缓存覆盖真实分数
    let source: any = g
    try {
      const res = await fetch(`/api/admin/girls?id=${(g as any).id}`, { headers: { Authorization: `Bearer ${token}` } })
      const fresh = await res.json()
      if (fresh && fresh.id) {
        source = fresh
        // 同步 girls 列表里的该条记录
        setGirls(prev => prev.map(x => (x as any).id === fresh.id ? { ...x, ...fresh } : x))
      }
    } catch {}
    const sd = source.score_detail || {}
    setEditingGirl({ ...source, is_locked: source.is_locked||false, user_eval_i18n: {zh:'','zh-tw':'',ja:'',en:'',...(source.user_eval_i18n||{})}, user_eval: source.user_eval||'', likes: source.likes||0, dislikes: source.dislikes||0, negative_tags: source.negative_tags||[], positive_tags: source.positive_tags||[], content_tags: source.content_tags||[], is_fushi: source.is_fushi||false, is_offline: source.is_offline||false, has_threshold: source.has_threshold||false, complaint_examples: source.complaint_examples||[], positive_examples: source.positive_examples||[], complaints: sd.complaints??0, positives: sd.positives??0, is_active: sd.is_active??true, engagement: sd.engagement??'medium', using_proxy: sd.using_proxy??false, is_verified: sd.is_verified??false, is_welfare: source.is_welfare !== false, is_manual_verified: source.is_manual_verified || false } as any)
    setNegText(((source.complaint_examples)||[]).join('\n'))
    setPosText(((source.positive_examples)||[]).join('\n'))
  }

  async function fetchPromos() {
    const res = await fetch('/api/admin/promotions', { headers: { Authorization: `Bearer ${token}` } })
    const d = await res.json()
    if (Array.isArray(d)) setPromos(d)
  }

  async function updateGirl(id: string, updates: Partial<Girl>) {
    await fetch('/api/admin/girls', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates })
    })
    fetchGirls()
  }

  async function saveGirl() {
    if (!editingGirl) return
    setSavingGirl(true)
    // raw text → array（只在保存时处理）
    const finalEditing = { ...editingGirl,
      complaint_examples: negText.split('\n').map(s => s.trim()).filter(Boolean),
      positive_examples: posText.split('\n').map(s => s.trim()).filter(Boolean),
    } as any
    setEditingGirl(finalEditing)
    const res = await fetch('/api/admin/records', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(finalEditing)
    })
    const json = await res.json()
    if (!json.ok) { alert('保存失败: ' + (json.error || '未知错误')); setSavingGirl(false); return }
    setGirls(girls.map(g => g.id === finalEditing.id ? { ...g, ...finalEditing } : g))
    // 同步更新账号数据库 tab 的状态
    setRecords((prev: any[]) => prev.map(r => r.id === finalEditing.id ? { ...r, ...finalEditing } : r))
    setEditingGirl(null)
    setSavingGirl(false)
  }

  async function deleteGirl(id: string) {
    if (!confirm('确认删除？')) return
    await fetch('/api/admin/girls', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    })
    fetchGirls()
  }

      async function fetchAllUsers() {
    const r = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (Array.isArray(d)) setAllUsers(d)
  }

  async function deleteUser(id: number) {
    if (!confirm('确认删除此用户记录？')) return
    const res = await fetch(`/api/admin/users?id=${id}`, { 
      method: 'DELETE', 
      headers: { Authorization: `Bearer ${token}` } 
    })
    if ((await res.json()).ok) fetchAllUsers()
  }

  async function fetchAllComments() {
    const r = await fetch('/api/admin/comments', { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (Array.isArray(d)) setAllComments(d)
  }

  async function fetchReports(status = reportStatus) {
    const r = await fetch(`/api/admin/reports?status=${status}`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (Array.isArray(d)) setReports(d)
  }

  async function handleReport(id: string, action: 'resolve' | 'dismiss', twitter_username: string) {
    const confirm_msg = action === 'resolve' ? `确认对 @${twitter_username} 执行扣100分处罚？` : '确认忽略此报告？'
    if (!confirm(confirm_msg)) return
    await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action, twitter_username })
    })
    fetchReports()
  }

  async function deleteComment(id: number) {
    if (!confirm('确认删除此吐槽？')) return
    const res = await fetch(`/api/admin/comments?id=${id}`, { 
      method: 'DELETE', 
      headers: { Authorization: `Bearer ${token}` } 
    })
    if ((await res.json()).ok) fetchAllComments()
  }

  async function fetchRecords() {
    const res = await fetch('/api/admin/records', { headers: { Authorization: `Bearer ${token}` } })
    const d = await res.json()
    if (Array.isArray(d)) setRecords(d)
  }

  async function saveSettings() {
    if (newPwd && newPwd !== newPwd2) { setSettingsMsg('两次新密码不一致'); return }
    const res = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        currentPassword: curPwd, 
        newUsername: newUsr || undefined, 
        newPassword: newPwd || undefined,
        settings: siteSettings 
      })
    })
    const d = await res.json()
    if (d.ok) { setSettingsMsg('✅ 保存成功'); setCurPwd(''); setNewUsr(''); setNewPwd(''); setNewPwd2('') }
    else setSettingsMsg('❌ ' + (d.error || '失败'))
  }

  async function addPromo() {
    if (!newPromo.twitter_username) return
    await fetch('/api/admin/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newPromo, is_active: true })
    })
    setNewPromo({ twitter_username: '', city: '', display_name: '' })
    fetchPromos()
  }

  async function togglePromo(id: string, is_active: boolean) {
    await fetch('/api/admin/promotions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, is_active })
    })
    fetchPromos()
  }

  async function deletePromo(id: string) {
    await fetch('/api/admin/promotions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    })
    fetchPromos()
  }

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e0e10' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ background: '#1a1a1f', border: '1px solid #2a2a35' }}>
        <h1 className="text-xl font-bold text-white mb-6">FLJ 后台管理</h1>
        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none"
          placeholder="用户名" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 outline-none"
          placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} />
        {loginErr && <p className="text-red-400 text-xs mb-3">{loginErr}</p>}
        <button onClick={login} className="w-full py-3 rounded-xl text-white font-medium"
          style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)' }}>登录</button>
      </div>
    </div>
  )

  const statusColor = (s: string) => s === 'normal' ? 'text-green-400' : s === 'warning' ? 'text-yellow-400' : 'text-red-400'


  return (
    <div className="min-h-screen flex" style={{ background: '#0e0e10' }}>

      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 220 : 56, background: '#111118', borderRight: '1px solid rgba(255,255,255,0.06)', transition: 'width 0.2s', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ padding: '18px 12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'white', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☰</button>
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg,#f43f8a,#fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>福利鉴后台</span>}
        </div>
        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {([['dashboard','📈','统计概览'],['girls','📊','福利姬管理'],['records','📋','账号数据库'],['promotions','📢','推广管理'],['users','👥','用户管理'],['comments','💬','吐槽管理'],['reports','🚨','错误报告'],['topups','💰','充值记录'],['settings','⚙️','账户设置']] as [string,string,string][]).map(([id,icon,label]) => (
            <button key={id} onClick={() => setTab(id as any)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '9px 12px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 3, background: tab === id ? 'rgba(244,63,138,0.15)' : 'transparent', color: tab === id ? '#f43f8a' : 'rgba(255,255,255,0.4)', fontSize: 14, transition: 'all 0.15s' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: 'nowrap', fontWeight: tab === id ? 600 : 400 }}>{label}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { setToken(''); localStorage.removeItem('flj_admin') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '9px 12px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            <span style={{ fontSize: 18 }}>🚪</span>
            {sidebarOpen && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'white' }}>
            {({ dashboard: '📈 统计概览', girls: '📊 福利姬管理', records: '📋 账号数据库', promotions: '📢 推广管理', users: '👥 用户管理', settings: '⚙️ 账户设置', comments: '💬 吐槽管理', reports: '🚨 错误报告', topups: '💰 充值记录' } as any)[tab]}
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider">Online: {onlineCount}</span>
          </div>
        </header>

        <div className="px-6 py-6" style={{ flex: 1 }}>

          {/* 统计概览 Dashboard */}
          {tab === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* 数据总览卡片 */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: '累计UV', val: dashboardData.summary.total_uv, icon: '👤', color: '#60a5fa' },
                  { label: '总收录', val: dashboardData.summary.total_girls, icon: '🔞', color: '#f472b6' },
                  { label: '总PV', val: dashboardData.summary.total_pv, icon: '👁️', color: '#34d399' },
                  { label: 'AI 分析次数', val: dashboardData.summary.total_search_ai, icon: '🧠', color: '#fbbf24' },
                  { label: '福利姬曝光数', val: dashboardData.summary.total_search_cache, icon: '✨', color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-white/40 text-xs mb-1">{s.icon} {s.label}</p>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.val?.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* 曲线图区域 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold text-white/80">访问趋势</h3>
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    {['1h','3h','12h','24h','1w','1m'].map(r => (
                      <button key={r} onClick={() => setDashRange(r)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dashRange === r ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-white/40 hover:text-white/60'}`}>{r.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                {/* 简单的 SVG 趋势图 */}
                <div className="h-64 w-full relative">
                  {dashboardData.series && dashboardData.series.length > 0 ? (() => {
                    const series = dashboardData.series
                    const maxVal = Math.max(...series.map((d:any) => Math.max(d.pv, d.search_ai, d.search_cache)), 1)
                    const width = 1000
                    const height = 200
                    const getPoints = (key: string) => series.map((d: any, i: number) => 
                      `${(i / (series.length - 1)) * width},${height - (d[key] / maxVal) * height}`
                    ).join(' ')

                    return (
                      <svg viewBox={`0 0 ${width} ${height + 40}`} className="w-full h-full overflow-visible">
                        {/* 背景网格线 */}
                        {[0, 0.25, 0.5, 0.75, 1].map(f => (
                          <line key={f} x1="0" y1={height * f} x2={width} y2={height * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        ))}
                        
                        {/* PV 曲线 (绿) */}
                        <polyline fill="none" stroke="#34d399" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={getPoints('pv')} style={{ filter: 'drop-shadow(0 4px 6px rgba(52,211,153,0.2))' }} />
                        {/* 缓存检索 (紫) */}
                        <polyline fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={getPoints('search_cache')} />
                        {/* AI 分析 (黄) */}
                        <polyline fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={getPoints('search_ai')} />

                        {/* X 轴标签 */}
                        {series.filter((_:any, i:number) => i % Math.max(1, Math.floor(series.length / 6)) === 0).map((d: any, i: number, arr: any[]) => {
                          const idx = series.indexOf(d)
                          return (
                            <text key={idx} x={(idx / (series.length - 1)) * width} y={height + 25} fill="rgba(255,255,255,0.2)" fontSize="12" textAnchor="middle">{d.time_key}</text>
                          )
                        })}
                      </svg>
                    )
                  })() : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">暂无数据上报</div>
                  )}
                </div>

                {/* 图例 */}
                <div className="flex justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-xs text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" /> 页面访问 (PV)</div>
                  <div className="flex items-center gap-2 text-xs text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" /> 福利姬曝光</div>
                  <div className="flex items-center gap-2 text-xs text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" /> 新 AI 分析</div>
                </div>
              </div>

              {/* 账号质量分布统计表 */}
              {dashboardData.girl_stats && (() => {
                const total = parseInt(dashboardData.summary.total_girls) || 1
                const gs = dashboardData.girl_stats
                const pct = (n: number) => ((n / total) * 100).toFixed(1) + '%'
                const rows = [
                  { label: '总收录福利账号', val: total, pct: '100%', color: '#60a5fa', icon: '🔞' },
                  { label: '可信账号', sub: '60分以上', val: parseInt(gs.trusted_count), color: '#34d399', icon: '✅' },
                  { label: '可疑账号', sub: '40分以下', val: parseInt(gs.suspicious_count), color: '#f87171', icon: '⚠️' },
                  { label: '有门槛账号', val: parseInt(gs.threshold_count), color: '#fbbf24', icon: '💰' },
                  { label: '诈骗账号', val: parseInt(gs.scam_count), color: '#f43f5e', icon: '🚨' },
                  { label: '皮下男账号', val: parseInt(gs.male_count), color: '#a78bfa', icon: '🚫' },
                  { label: '盗图账号', val: parseInt(gs.stolen_count), color: '#fb923c', icon: '📷' },
                ]
                return (
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-bold text-white/80 mb-4">📊 账号质量分布</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/30 text-xs border-b border-white/5">
                            <th className="text-left pb-3 font-medium">类别</th>
                            <th className="text-right pb-3 font-medium">数量</th>
                            <th className="text-right pb-3 font-medium pr-2">占比</th>
                            <th className="pb-3 w-40 hidden sm:table-cell" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-b border-white/5 last:border-0">
                              <td className="py-3 text-white/70">
                                {r.icon} {r.label}
                                {r.sub && <span className="ml-1 text-xs text-white/30">({r.sub})</span>}
                              </td>
                              <td className="py-3 text-right font-mono font-bold" style={{ color: r.color }}>{r.val.toLocaleString()}</td>
                              <td className="py-3 text-right pr-3 text-white/40 text-xs font-mono">{i === 0 ? '100%' : pct(r.val)}</td>
                              <td className="py-3 hidden sm:table-cell">
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-full">
                                  <div className="h-full rounded-full transition-all" style={{ width: i === 0 ? '100%' : pct(r.val), background: r.color, opacity: 0.7 }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 福利姬管理 */}
          {tab === 'girls' && (
            <div>
              {/* 搜索 + 统计 */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <p className="text-white/30 text-sm">共 {girls.length} 条记录</p>
                <input
                  value={girlSearch}
                  onChange={e => { setGirlSearch(e.target.value); setGirlPage(1) }}
                  placeholder="🔍 搜索用户名 / 昵称..."
                  className="flex-1 min-w-[200px] max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none placeholder:text-white/20"
                />
                {girlSearch && <button onClick={() => { setGirlSearch(''); setGirlPage(1) }} className="text-white/30 text-xs hover:text-white/60">✕ 清除</button>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-3 pr-4">账号</th>
                      <th className="text-left py-3 pr-4">城市</th>
                      <th className="text-left py-3 pr-4">评分</th>
                      <th className="text-left py-3 pr-4">投诉</th>
                      <th className="text-left py-3 pr-4">搜索次数</th>
                      <th className="text-left py-3 pr-4">状态</th>
                      <th className="text-left py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = girls.filter(g =>
                        !girlSearch ||
                        g.twitter_username?.toLowerCase().includes(girlSearch.toLowerCase()) ||
                        (g.display_name || '').toLowerCase().includes(girlSearch.toLowerCase())
                      )
                      const totalPages = Math.ceil(filtered.length / GIRLS_PER_PAGE)
                      const paged = filtered.slice((girlPage - 1) * GIRLS_PER_PAGE, girlPage * GIRLS_PER_PAGE)
                      return (<>
                        {paged.map(g => (
                      <tr key={g.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="py-3 pr-4">
                          <div>
                            <p className="text-white">{g.display_name || `@${g.twitter_username}`}</p>
                            <a href={`https://x.com/${g.twitter_username}`} target="_blank" className="text-pink-400/60 text-xs">@{g.twitter_username}</a>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-white/50">{g.city}</td>
                        <td className="py-3 pr-4">
                          <span className={g.score >= 62 ? 'text-green-400' : g.score >= 38 ? 'text-yellow-400' : 'text-red-400'}>{g.score}</span>
                        </td>
                        <td className="py-3 pr-4 text-red-400/70">{g.score_detail?.complaints || 0}</td>
                        <td className="py-3 pr-4 text-white/30">{g.search_count}</td>
                        <td className="py-3 pr-4"><span className={statusColor(g.status)}>{g.status}</span></td>
                        <td className="py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => updateGirl(g.id, { is_promoted: !g.is_promoted })}
                              className={`text-xs px-2 py-1 rounded-lg ${g.is_promoted ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-white/30'}`}>
                              {g.is_promoted ? '⭐ 已推' : '⭐ 推荐'}
                            </button>
                            <button onClick={() => updateGirl(g.id, { status: g.status === 'warning' ? 'normal' : 'warning' })}
                              className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400">⚠️ 警告</button>
                            <button onClick={() => openEditGirl(g)}
                              className="text-xs px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400">✏️ 编辑</button>
                            <button onClick={() => deleteGirl(g.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">🗑️</button>
                          </div>
                        </td>
                      </tr>
                        ))}
                        {/* 分页控件 */}
                        {totalPages > 1 && (
                          <tr><td colSpan={7} style={{ paddingTop: 16, paddingBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                                {filtered.length} 条 / 第 {girlPage}/{totalPages} 页
                              </span>
                              <button disabled={girlPage === 1} onClick={() => setGirlPage(1)}
                                style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: girlPage === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: girlPage === 1 ? 'default' : 'pointer' }}>«</button>
                              <button disabled={girlPage === 1} onClick={() => setGirlPage(p => p - 1)}
                                style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: girlPage === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: girlPage === 1 ? 'default' : 'pointer' }}>‹ 上一页</button>
                              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const p = totalPages <= 7 ? i + 1 : girlPage <= 4 ? i + 1 : girlPage >= totalPages - 3 ? totalPages - 6 + i : girlPage - 3 + i
                                return (
                                  <button key={p} onClick={() => setGirlPage(p)}
                                    style={{ padding: '3px 8px', borderRadius: 6, background: p === girlPage ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.05)', border: `1px solid ${p === girlPage ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)'}`, color: p === girlPage ? '#f9a8d4' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>{p}</button>
                                )
                              })}
                              <button disabled={girlPage === totalPages} onClick={() => setGirlPage(p => p + 1)}
                                style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: girlPage === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: girlPage === totalPages ? 'default' : 'pointer' }}>下一页 ›</button>
                              <button disabled={girlPage === totalPages} onClick={() => setGirlPage(totalPages)}
                                style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: girlPage === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: girlPage === totalPages ? 'default' : 'pointer' }}>»</button>
                            </div>
                          </td></tr>
                        )}
                      </>)
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 账号数据库 */}
          {tab === 'records' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{records.length} 条记录</span>
                <input value={recSearch} onChange={e => { setRecSearch(e.target.value); setRecPage(1) }} placeholder="🔍 搜索用户名 / 昵称..."
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: 'white', outline: 'none', width: 200, fontSize: 13 }} />
                {recSearch && <button onClick={() => { setRecSearch(''); setRecPage(1) }} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['用户名','昵称','分数','语言','福利','风俗','线下','门槛','负面标签','正面标签','👍','👎','缓存时间','操作'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.25)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = records.filter((r: any) => !recSearch || (r.twitter_username||'').includes(recSearch) || (r.display_name||'').includes(recSearch))
                      const totalPages = Math.ceil(filtered.length / REC_PER_PAGE)
                      const paged = filtered.slice((recPage - 1) * REC_PER_PAGE, recPage * REC_PER_PAGE)
                      return (<>
                        {paged.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px' }}><a href={`/verify/${r.twitter_username}`} target="_blank" style={{ color: '#f43f8a', textDecoration: 'none' }}>@{r.twitter_username}</a></td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.6)' }}>{r.is_manual_verified && <span style={{color:'#3b82f6',marginRight:4}}>☑️</span>}{r.display_name||'—'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: r.score>=62?'#4ade80':r.score>=38?'#facc15':'#f87171' }}>{r.score}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.4)' }}>{r.account_language||'—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.is_welfare!==false?'🔞':'—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.is_fushi?'✅':'—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.is_offline?'✅':'—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{r.has_threshold?'⚠️':'—'}</td>
                        <td style={{ padding: '8px 10px' }}>{(r.negative_tags||[]).map((t:string) => <span key={t} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 4, padding: '1px 5px', marginRight: 3, fontSize: 11 }}>{t}</span>)}</td>
                        <td style={{ padding: '8px 10px' }}>{(r.positive_tags||[]).map((t:string) => <span key={t} style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', borderRadius: 4, padding: '1px 5px', marginRight: 3, fontSize: 11 }}>{t}</span>)}</td>
                        <td style={{ padding: '8px 10px', color: '#4ade80' }}>{r.likes}</td>
                        <td style={{ padding: '8px 10px', color: '#f87171' }}>{r.dislikes}</td>
                        <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{r.cached_at ? new Date(r.cached_at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button onClick={async () => { await fetch(`/api/admin/records?id=${r.id}`,{method:'DELETE'}); setRecords(records.filter((x:any) => x.id !== r.id)) }}
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>删除</button>
                        </td>
                      </tr>
                        ))}
                        {totalPages > 1 && (
                          <tr><td colSpan={14} style={{ paddingTop: 14, paddingBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{filtered.length} 条 / 第 {recPage}/{totalPages} 页</span>
                              <button disabled={recPage===1} onClick={() => setRecPage(1)} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:recPage===1?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.6)', fontSize:12, cursor:recPage===1?'default':'pointer' }}>«</button>
                              <button disabled={recPage===1} onClick={() => setRecPage(p=>p-1)} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:recPage===1?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.6)', fontSize:12, cursor:recPage===1?'default':'pointer' }}>‹ 上页</button>
                              {Array.from({length:Math.min(totalPages,7)},(_,i)=>{const p=totalPages<=7?i+1:recPage<=4?i+1:recPage>=totalPages-3?totalPages-6+i:recPage-3+i;return(<button key={p} onClick={()=>setRecPage(p)} style={{padding:'3px 8px',borderRadius:6,background:p===recPage?'rgba(236,72,153,0.3)':'rgba(255,255,255,0.05)',border:`1px solid ${p===recPage?'rgba(236,72,153,0.5)':'rgba(255,255,255,0.1)'}`,color:p===recPage?'#f9a8d4':'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer'}}>{p}</button>)})}
                              <button disabled={recPage===totalPages} onClick={() => setRecPage(p=>p+1)} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:recPage===totalPages?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.6)', fontSize:12, cursor:recPage===totalPages?'default':'pointer' }}>下页 ›</button>
                              <button disabled={recPage===totalPages} onClick={() => setRecPage(totalPages)} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:recPage===totalPages?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.6)', fontSize:12, cursor:recPage===totalPages?'default':'pointer' }}>»</button>
                            </div>
                          </td></tr>
                        )}
                      </>)
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 推广管理 */}
          {tab === 'promotions' && (
            <div>
              <div className="p-4 rounded-2xl mb-6" style={{ background: '#1a1a1f', border: '1px solid #2a2a35' }}>
                <p className="text-white font-medium mb-3">添加推广账号</p>
                <div className="flex gap-3 flex-wrap">
                  <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none flex-1" placeholder="推特用户名（不带@）" value={newPromo.twitter_username} onChange={e => setNewPromo(p => ({...p,twitter_username:e.target.value}))} />
                  <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none w-32" placeholder="城市" value={newPromo.city} onChange={e => setNewPromo(p => ({...p,city:e.target.value}))} />
                  <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none flex-1" placeholder="显示名称" value={newPromo.display_name} onChange={e => setNewPromo(p => ({...p,display_name:e.target.value}))} />
                  <button onClick={addPromo} className="px-4 py-2 rounded-xl text-white text-sm" style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)' }}>添加</button>
                </div>
              </div>
              <div className="space-y-3">
                {promos.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#1a1a1f', border: '1px solid #2a2a35' }}>
                    <div className="flex-1">
                      <p className="text-white text-sm">{p.display_name || `@${p.twitter_username}`}</p>
                      <p className="text-pink-400/60 text-xs">@{p.twitter_username} · {p.city || '全城市'}</p>
                    </div>
                    <button onClick={() => togglePromo(p.id, !p.is_active)} className={`text-xs px-3 py-1.5 rounded-lg ${p.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}>{p.is_active ? '✅ 启用' : '⏸ 暂停'}</button>
                    <button onClick={() => deletePromo(p.id)} className="text-red-400/60 hover:text-red-400 text-xs">删除</button>
                  </div>
                ))}
                {promos.length === 0 && <p className="text-white/20 text-sm">暂无推广账号</p>}
              </div>
            </div>
          )}

          {/* 用户管理 */}
          {tab === 'users' && (
            <div>
              {(() => {
                const members = allUsers.filter((u:any) => u.is_member)
                const tgUsers = allUsers.filter((u:any) => !u.is_member)
                const filtered = userFilter === 'member' ? members : userFilter === 'tg_user' ? tgUsers : allUsers
                return (<>
              <div className="flex gap-2 mb-4">
                {([['all','全部',allUsers.length],['member','⭐ 天龙人',members.length],['tg_user','🔵 居委会',tgUsers.length]] as [string,string,number][]).map(([f,label,cnt]) => (
                  <button key={f} onClick={() => setUserFilter(f as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${userFilter===f ? 'bg-pink-500 text-white border-pink-500' : 'text-white/40 border-white/10 hover:border-white/20'}`}>
                    {label} ({cnt})
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-sm mb-4">显示 {filtered.length} / {allUsers.length} 位用户</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-3 pr-4">头像</th>
                      <th className="text-left py-3 pr-4">Telegram ID</th>
                      <th className="text-left py-3 pr-4">用户名/昵称</th>
                      <th className="text-left py-3 pr-4">今日搜索</th>
                      <th className="text-left py-3 pr-4">累计搜索</th>
                      <th className="text-left py-3 pr-4">积分</th>
                      <th className="text-left py-3 pr-4">最后活跃</th>
                      <th className="text-left py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u:any) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="py-3 pr-4">
                          {u.photo_url ? (
                            <img src={u.photo_url} className="w-8 h-8 rounded-full border border-white/10" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs">👤</div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-white/40 font-mono text-xs">{u.telegram_id}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium">{u.first_name || '—'}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${u.is_member ? 'bg-yellow-500/15 text-yellow-400' : 'bg-blue-500/15 text-blue-400'}`}>
                              {u.is_member ? '天龙人' : (() => { const p = u.points||0; if(p>=500000)return'正部'; if(p>=100000)return'副部'; if(p>=50000)return'正厅'; if(p>=20000)return'副厅'; if(p>=10000)return'正处'; if(p>=5000)return'副处'; if(p>=3000)return'正科'; if(p>=1000)return'副科'; return'居委会' })()}
                            </span>
                          </div>
                          {u.username && <p className="text-pink-400/60 text-xs">@{u.username}</p>}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.today_count > 8 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                            {u.today_count || 0}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-white/60 font-mono text-xs">{u.search_count || 0}</td>
                        <td className="py-3 pr-4 text-white/30 text-xs">{u.points ?? 0} 分</td>
                        <td className="py-3 pr-4 text-white/30 text-xs">{new Date(u.last_login).toLocaleString()}</td>
                        <td className="py-3">
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={async () => {
                                const res = await fetch('/api/admin/users/moderator', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: u.id, is_moderator: !u.is_moderator }) })
                                if (res.ok) setAllUsers((prev: any[]) => prev.map((x: any) => x.id === u.id ? { ...x, is_moderator: !u.is_moderator } : x))
                              }}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: u.is_moderator ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', color: u.is_moderator ? '#c084fc' : 'rgba(255,255,255,0.3)', border: u.is_moderator ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                              {u.is_moderator ? '🛡️ 纪检委' : '任命'}
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="text-red-400 text-xs px-2 py-1 rounded bg-red-400/10">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>)})()}
            </div>
          )}
          {/* 吐槽管理 */}
          {tab === 'comments' && (
            <div>
              {/* 子 Tab */}
              {(() => {
                const flaggedCount = allComments.filter((c:any) => c.is_expose && (c.upvotes - c.downvotes) < -30).length
                return (
                  <div className="flex gap-2 mb-5">
                    {([['list','📋 爆料列表', 0],['images','🖼️ 图片审核', 0]] as [string,string,number][]).map(([id,label,badge]) => (
                      <button key={id} onClick={() => setCommentSubTab(id as any)}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                        style={{ background: commentSubTab===id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: commentSubTab===id ? 'white' : 'rgba(255,255,255,0.4)', border: `1px solid ${commentSubTab===id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                        {label}
                        {badge > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-400">{badge}</span>}
                      </button>
                    ))}
                  </div>
                )
              })()}

              {/* 爆料人工审核区 */}
              {false && (() => {
                const exposes = allComments.filter((c:any) => c.is_expose).sort((a:any,b:any) => b.downvotes - a.downvotes)
                const flagged = exposes.filter((c:any) => (c.upvotes - c.downvotes) < -30)
                async function toggleCollapse(id: number, collapsed: boolean) {
                  await fetch('/api/admin/collapse', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({comment_id:id, collapsed}) })
                  setAllComments(prev => prev.map((c:any) => c.id===id ? {...c, is_collapsed: collapsed} : c))
                }
                return exposes.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-white font-bold text-sm mb-3">🔥 爆料人工审核
                      {flagged.length > 0 && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{flagged.length} 条待审核</span>}
                    </h3>
                    <div className="space-y-2">
                      {exposes.map((cm:any) => {
                        const isFlagged = (cm.upvotes - cm.downvotes) < -30
                        return (
                          <div key={cm.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                            style={{ background: isFlagged ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isFlagged ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <a href={`/verify/${cm.twitter_username}`} target="_blank" className="text-pink-400 text-xs">@{cm.twitter_username}</a>
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(cm.created_at).toLocaleDateString()}</span>
                                {cm.is_collapsed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400">已折叠</span>}
                              </div>
                              <p className="text-white/80 text-sm truncate">{cm.content}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold text-green-400">✓ {cm.upvotes}</span>
                              <span className={`text-xs font-bold ${isFlagged ? 'text-red-400' : 'text-white/40'}`}>✗ {cm.downvotes}</span>
                              {cm.is_collapsed
                                ? <button onClick={() => toggleCollapse(cm.id, false)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>恢复</button>
                                : <button onClick={() => toggleCollapse(cm.id, true)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: isFlagged ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', color: isFlagged ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>折叠</button>
                              }
                              <button onClick={() => deleteComment(cm.id)} className="text-red-400 text-xs px-2 py-1 rounded bg-red-400/10">删除</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <hr className="border-white/5 my-5" />
                  </div>
                ) : null
              })()}



              {commentSubTab === 'list' && <><p className="text-white/30 text-sm mb-4">共 {allComments.filter((c:any)=>c.is_expose).length} 条爆料</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-3 pr-4">时间</th>
                      <th className="text-left py-3 pr-4">吐槽对象</th>
                      <th className="text-left py-3 pr-4">吐槽者</th>
                      <th className="text-left py-3 pr-4">内容</th>
                      <th className="text-left py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allComments.filter((cm:any) => cm.is_expose).map(cm => (
                      <tr key={cm.id} className="border-b border-white/5 hover:bg-white/2" style={cm.is_collapsed ? { opacity: 0.45 } : {}}>
                        <td className="py-3 pr-4 text-white/30 whitespace-nowrap">{new Date(cm.created_at).toLocaleString()}</td>
                        <td className="py-3 pr-4">
                          <a href={`/verify/${cm.twitter_username}`} target="_blank" className="text-pink-400">@{cm.twitter_username}</a>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                             {cm.user_avatar && <img src={cm.user_avatar} className="w-5 h-5 rounded-full" />}
                             <div>
                               <span className={cm.is_expose ? 'text-red-400 font-semibold' : 'text-white/60'}>
                                 {cm.is_expose
  ? (cm.user_tier === 'member' ? '⭐ 天龙人' : cm.user_tier === 'tg_user' ? '🔵 居委会' : '🔥 匿名')
  : cm.user_name}
                               </span>
                               {cm.is_expose && cm.reporter_ip && (
                                 <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>IP: {cm.reporter_ip}</p>
                               )}
                             </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-white/80 max-w-xs truncate" title={cm.content}>{cm.content}</td>
                        <td className="py-3">
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={async () => {
                                const res = await fetch('/api/admin/collapse', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ comment_id: cm.id, collapsed: !cm.is_collapsed }) })
                                if (res.ok) setAllComments((prev: any[]) => prev.map((x: any) => x.id === cm.id ? { ...x, is_collapsed: !cm.is_collapsed } : x))
                              }}
                              className="text-xs px-2 py-1 rounded"
                              style={cm.is_collapsed
                                ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                                : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                              {cm.is_collapsed ? '恢复' : '折叠'}
                            </button>
                            <button onClick={() => deleteComment(cm.id)} className="text-red-400 text-xs px-2 py-1 rounded bg-red-400/10">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>}

              {commentSubTab === 'images' && <ImageReview
                pendingImages={pendingImages}
                setPendingImages={setPendingImages}
                imagesLoaded={imagesLoaded}
                setImagesLoaded={setImagesLoaded}
                token={token}
              />}
            </div>
          )}

          {/* 错误报告 */}
          {tab === 'reports' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['pending','resolved','dismissed'] as const).map(s => (
                  <button key={s} onClick={() => { setReportStatus(s); fetchReports(s) }}
                    style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                      background: reportStatus === s ? '#f43f8a22' : 'rgba(255,255,255,0.07)',
                      color: reportStatus === s ? '#f43f8a' : 'rgba(255,255,255,0.5)' }}>
                    {s === 'pending' ? '⏳ 待处理' : s === 'resolved' ? '✅ 已处罚' : '🗑️ 已忽略'}
                  </button>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginLeft: 8, alignSelf: 'center' }}>共 {reports.length} 条</span>
              </div>
              {reports.length === 0
                ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>暂无报告</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reports.map((r: any) => (
                      <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <a href={`/verify/${r.twitter_username}`} target="_blank"
                                style={{ color: '#f43f8a', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                                @{r.twitter_username}
                              </a>
                              {r.score != null && (
                                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 6,
                                  background: r.score >= 60 ? 'rgba(74,222,128,0.15)' : r.score >= 40 ? 'rgba(250,204,21,0.15)' : 'rgba(248,113,113,0.15)',
                                  color: r.score >= 60 ? '#4ade80' : r.score >= 40 ? '#facc15' : '#f87171' }}>
                                  {r.score}分
                                </span>
                              )}
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{new Date(r.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}</span>
                            </div>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, wordBreak: 'break-all' }}>{r.reason}</p>
                            {r.reporter_ip && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>IP: {r.reporter_ip}</p>}
                          </div>
                          {reportStatus === 'pending' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => handleReport(r.id, 'resolve', r.twitter_username)}
                                style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: 'rgba(248,113,113,0.2)', color: '#f87171', fontWeight: 600 }}>
                                ⚡ 扣100分
                              </button>
                              <button onClick={() => handleReport(r.id, 'dismiss', r.twitter_username)}
                                style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                                忽略
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* 充值记录 */}
          {tab === 'topups' && (
            <div>
              <p className="text-white/30 text-sm mb-4">共 {topups.length} 条充值记录</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5 text-xs">
                      <th className="pb-2 pr-4 text-left font-normal">时间</th>
                      <th className="pb-2 pr-4 text-left font-normal">用户 TG ID</th>
                      <th className="pb-2 pr-4 text-left font-normal">档位</th>
                      <th className="pb-2 pr-4 text-right font-normal">FLJ 数量</th>
                      <th className="pb-2 pr-4 text-right font-normal">USDT 价值</th>
                      <th className="pb-2 pr-4 text-right font-normal">获得积分</th>
                      <th className="pb-2 text-left font-normal">TX Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map((r: any) => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 text-xs">
                        <td className="py-3 pr-4 text-white/30 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-white/60">{r.tg_user_id}</td>
                        <td className="py-3 pr-4 text-white/80">{r.tier_label}</td>
                        <td className="py-3 pr-4 text-right text-white/60">{Number(r.flj_amount).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-green-400">${Number(r.usdt_value).toFixed(4)}</td>
                        <td className="py-3 pr-4 text-right font-bold" style={{ color: '#c084fc' }}>+{r.points_granted.toLocaleString()}</td>
                        <td className="py-3 text-white/30 font-mono text-[10px] max-w-[120px] truncate">
                          <a href={`https://bscscan.com/tx/${r.tx_hash}`} target="_blank" className="hover:text-white/60">{r.tx_hash}</a>
                        </td>
                      </tr>
                    ))}
                    {topups.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-white/20">暂无充值记录</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 账户设置 */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* 安全校验 */}
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: 16 }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, display: 'block', marginBottom: 8 }}>🔐 管理员身份验证</label>
                <input type="password" value={curPwd} onChange={e => { setCurPwd(e.target.value); setSettingsMsg('') }}
                  placeholder="请输入当前登录密码以保存修改"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              {/* API 状态与余额 */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🔌 API 状态与用量
                  {!usage && <span className="animate-pulse text-[10px] bg-white/5 px-2 py-0.5 rounded">加载中...</span>}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Twitter Usage */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>X (Twitter) API v2</span>
                      {usage?.twitter?.ok ? (
                        <span style={{ fontSize: 11, color: '#4ade80' }}>连接正常</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#f87171' }}>连接失败</span>
                      )}
                    </div>
                    {usage?.twitter?.ok && (
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                            月度用量: <span style={{ fontWeight: 600 }}>{usage.twitter.data.data?.project_usage || 0}</span> / {usage.twitter.data.data?.project_cap || 0}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                            重置: 每月 {usage.twitter.data.data?.cap_reset_day || '--'} 日
                          </span>
                        </div>
                        <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, (usage.twitter.data.data?.project_usage / usage.twitter.data.data?.project_cap) * 100 || 0)}%`, 
                            background: (usage.twitter.data.data?.project_usage / usage.twitter.data.data?.project_cap) > 0.8 ? '#f87171' : '#f43f8a',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    )}
                    {usage?.twitter?.error && (
                      <p style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6, margin: '6px 0 0' }}>
                        {usage.twitter.error}
                      </p>
                    )}
                  </div>

                  {/* xAI Grok Status */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>xAI Grok API (Search)</span>
                      {usage?.xai?.ok ? (
                        <span style={{ fontSize: 11, color: '#4ade80' }}>Key 有效</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#f87171' }}>验证失败</span>
                      )}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                        {usage?.xai?.ok ? `✅ 连接成功 (可用模型: ${usage.xai.data.model_count} 个)` : '❌ 无法连接到 xAI 服务器'}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                        * xAI 官方目前不提供 API 余额查询，请前往控制台查看。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>⚙️ 系统功能配置</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'block', marginBottom: 8 }}>假搜索过程时长 (秒)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>最小</span>
                        <input type="number" value={siteSettings.search_duration_min} 
                          onChange={e => setSiteSettings({...siteSettings, search_duration_min: e.target.value})}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.1)' }}>—</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>最大</span>
                        <input type="number" value={siteSettings.search_duration_max} 
                          onChange={e => setSiteSettings({...siteSettings, search_duration_max: e.target.value})}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                      * 当账号已有缓存数据时，用户点击搜索会显示的进度条总时长（范围随机）。
                    </p>
                  </div>
                  <button onClick={saveSettings} style={{ marginTop: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 10, padding: '10px 0', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>保存系统配置</button>
                  {settingsMsg && <p style={{ fontSize: 12, color: settingsMsg.startsWith('✅') ? '#4ade80' : '#f87171', margin: '4px 0 0', textAlign: 'center' }}>{settingsMsg}</p>}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>修改账户信息</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>
                    * 如需修改，请填写以下项（不修改请留空）。
                  </p>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'block', marginBottom: 6 }}>新用户名</label>
                    <input value={newUsr} onChange={e => setNewUsr(e.target.value)} placeholder="新用户名 / 邮箱"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'block', marginBottom: 6 }}>新密码（留空不修改）</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'block', marginBottom: 6 }}>确认新密码</label>
                    <input type="password" value={newPwd2} onChange={e => setNewPwd2(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  {settingsMsg && <p style={{ fontSize: 13, color: settingsMsg.startsWith('✅') ? '#4ade80' : '#f87171', margin: 0 }}>{settingsMsg}</p>}
                  <button onClick={saveSettings} style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)', border: 'none', color: 'white', borderRadius: 10, padding: '11px 0', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>保存修改</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 编辑弹窗 */}
      {/* 编辑弹窗 */}
      {editingGirl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold mb-5">✏️ 编辑 @{editingGirl.twitter_username}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-white/40 text-xs block mb-1.5">综合得分</label>
                <input type="number" value={editingGirl.score}
                  onChange={e => setEditingGirl({ ...editingGirl, score: +e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-2">账户评价（多语言）</label>
                <div className="flex gap-1 mb-2">
                  {(['zh','zh-tw','ja','en'] as const).map(l => (
                    <button key={l} onClick={() => setEvalLang(l)}
                      className={"text-xs px-3 py-1 rounded-lg " + (evalLang === l ? "text-white" : "bg-white/5 text-white/30")}
                      style={evalLang === l ? {background:'linear-gradient(135deg,#f43f8a44,#e0368c44)',border:'1px solid #f43f8a44'} : {}}>
                      {l === 'zh' ? '简中' : l === 'zh-tw' ? '繁中' : l === 'ja' ? '日文' : 'EN'}
                    </button>
                  ))}
                </div>
                <textarea rows={4}
                  value={((editingGirl as any).user_eval_i18n || {})[evalLang] || ''}
                  onChange={e => setEditingGirl({ ...editingGirl, user_eval_i18n: { ...((editingGirl as any).user_eval_i18n || {}), [evalLang]: e.target.value }, user_eval: evalLang === 'zh' ? e.target.value : editingGirl.user_eval } as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs block mb-1.5">👍 有用数</label>
                  <input type="number" value={editingGirl.likes}
                    onChange={e => setEditingGirl({ ...editingGirl, likes: +e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1.5">👎 无用数</label>
                  <input type="number" value={editingGirl.dislikes}
                    onChange={e => setEditingGirl({ ...editingGirl, dislikes: +e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-2">🚨 负面标签</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'scam', label: '💸 骗钱跑路' },
                    { value: 'impersonation', label: '🎭 冒充他人' },
                    { value: 'stolen_photo', label: '📸 盗图' },
                    { value: 'fake_gender', label: '👤 假冒性别' },
                  ].map(tag => {
                    const selected = (editingGirl.negative_tags || []).includes(tag.value)
                    return (
                      <button key={tag.value} type="button"
                        onClick={() => {
                          const cur = editingGirl.negative_tags || []
                          setEditingGirl({ ...editingGirl, negative_tags: selected ? cur.filter((t: string) => t !== tag.value) : [...cur, tag.value] })
                        }}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${selected ? '#f87171' : 'rgba(255,255,255,0.1)'}`, background: selected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', color: selected ? '#f87171' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-2">✅ 正面标签</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'praised', label: '💬 好评如潮' },
                    { value: 'verified_real', label: '✅ 真实可信' },
                    { value: 'recommended', label: '👍 用户推荐' },
                    { value: 'trusted', label: '🔒 高度信任' },
                  ].map(tag => {
                    const selected = (editingGirl.positive_tags || []).includes(tag.value)
                    return (
                      <button key={tag.value} type="button"
                        onClick={() => {
                          const cur = editingGirl.positive_tags || []
                          setEditingGirl({ ...editingGirl, positive_tags: selected ? cur.filter((t: string) => t !== tag.value) : [...cur, tag.value] })
                        }}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${selected ? '#4ade80' : 'rgba(255,255,255,0.1)'}`, background: selected ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)', color: selected ? '#4ade80' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-4 flex-wrap items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!(editingGirl as any).is_welfare}
                    onChange={e => setEditingGirl({ ...editingGirl, is_welfare: e.target.checked } as any)} />
                  <span className="text-pink-400 font-bold text-sm">🔞 福利账号</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!(editingGirl as any).is_manual_verified}
                    onChange={e => setEditingGirl({ ...editingGirl, is_manual_verified: e.target.checked } as any)} />
                  <span className="text-blue-400 font-bold text-sm">☑️ 官方认证</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={((editingGirl as any).negative_tags || []).includes('scam')}
                    onChange={e => {
                      const cur: string[] = (editingGirl as any).negative_tags || []
                      const hasScam = cur.includes('scam')
                      const newTags = e.target.checked ? (hasScam ? cur : [...cur, 'scam']) : cur.filter((t: string) => t !== 'scam')
                      const baseScore = (editingGirl as any).score || 0
                      const newScore = e.target.checked
                        ? Math.max(1, baseScore - 100)
                        : Math.min(200, baseScore + 100)
                      setEditingGirl({ ...editingGirl, negative_tags: newTags, score: newScore } as any)
                    }} />
                  <span className="text-red-400 font-bold text-sm">🚨 诈骗账号（-100分）</span>
                </label>
                {[['is_fushi','風俗業者'],['is_offline','可线下'],['has_threshold','有门槛费']].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(editingGirl as any)[k]}
                      onChange={e => setEditingGirl({ ...editingGirl, [k]: e.target.checked } as any)} />
                    <span className="text-white/60 text-sm">{label}</span>
                  </label>
                ))}
                </div>
                {/* 内容类型标签 */}
                <div className="mt-3">
                  <p className="text-white/40 text-xs mb-2">🏷️ 内容类型标签（最多5个）</p>
                  <div className="flex flex-wrap gap-2">
                    {['巨乳','童颜','御姐','萝莉','美腿','黑丝','不露脸','多人','SM','调教','女同','4P','熟女','美臀','纯爱','情侣','NTR','小狗'].map(tag => {
                      const tags: string[] = (editingGirl as any).content_tags || []
                      const active = tags.includes(tag)
                      return (
                        <button key={tag} type="button"
                          onClick={() => {
                            const cur: string[] = (editingGirl as any).content_tags || []
                            const next = cur.includes(tag)
                              ? cur.filter((t:string) => t !== tag)
                              : cur.length < 5 ? [...cur, tag] : cur
                            setEditingGirl({ ...editingGirl, content_tags: next } as any)
                          }}
                          className="text-xs px-2 py-0.5 rounded-full transition-all"
                          style={{ background: active ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)', color: active ? '#c084fc' : 'rgba(255,255,255,0.35)', border: `1px solid ${active ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-sm">性别</span>
                  <select value={(editingGirl as any).gender || 'unknown'}
                    onChange={e => setEditingGirl({ ...editingGirl, gender: e.target.value } as any)}
                    style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 8px', color:'white', outline:'none', fontSize:13 }}>
                    <option value="unknown">❓ 未知</option>
                    <option value="female">♀ 女性</option>
                    <option value="male">♂ 男性</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                  <input type="checkbox" checked={!!(editingGirl as any).is_locked}
                    onChange={e => setEditingGirl({ ...editingGirl, is_locked: e.target.checked } as any)} />
                  <span className="text-yellow-400/80 text-sm font-medium">🔒 锁定（不自动清除）</span>
                </label>
              </div>

              {/* 限制曝光 */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={!!(editingGirl as any).is_restricted}
                    onChange={e => setEditingGirl({ ...editingGirl, is_restricted: e.target.checked } as any)} />
                  <span className="text-red-400 text-sm font-bold">🚫 限制曝光（搜索时显示自定义文本）</span>
                </label>
                {!!(editingGirl as any).is_restricted && (
                  <textarea
                    rows={4}
                    placeholder="搜索该账号时显示的文本内容，例如：该账号已申请隐私保护，暂不公开相关信息。"
                    value={(editingGirl as any).restricted_message || ''}
                    onChange={e => setEditingGirl({ ...editingGirl, restricted_message: e.target.value } as any)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.3)', color: 'white' }}
                  />
                )}
              </div>
            </div>

              <hr className="border-white/10" />
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">📊 得分明细（影响最终得分）</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs block mb-1.5">🚨 投诉数 (×-5)</label>
                  <input type="number" value={(editingGirl as any).complaints ?? 0}
                    onChange={e => setEditingGirl({ ...editingGirl, complaints: +e.target.value } as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1.5">👍 好评数 (×+10)</label>
                  <input type="number" value={(editingGirl as any).positives ?? 0}
                    onChange={e => setEditingGirl({ ...editingGirl, positives: +e.target.value } as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs block mb-1.5">💬 互动活跃度</label>
                  <select value={(editingGirl as any).engagement ?? 'medium'}
                    onChange={e => setEditingGirl({ ...editingGirl, engagement: e.target.value } as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                    <option value="high">高 (+10)</option>
                    <option value="medium">中 (+5)</option>
                    <option value="low">低 (+0)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  {[['is_active','✅ 近期活跃 (+5)'],['is_verified','🔵 蓝V (+10)'],['using_proxy','🔒 VPN (-5)']].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!(editingGirl as any)[k]}
                        onChange={e => setEditingGirl({ ...editingGirl, [k]: e.target.checked } as any)} />
                      <span className="text-white/60 text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <hr className="border-white/10" />
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">🗣 他人评价（每行一条）</p>
              <div>
                <label className="text-white/40 text-xs block mb-1.5">🚨 负面评价引用</label>
                <textarea rows={4} value={negText}
                  onChange={e => setNegText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-y font-mono"
                  placeholder="每行输入一条负面评价..." />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1.5">👍 正面评价引用</label>
                <textarea rows={4} value={posText}
                  onChange={e => setPosText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-y font-mono"
                  placeholder="每行输入一条正面评价..." />
              </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setEditingGirl(null); setNegText(''); setPosText('') }}
                className="px-5 py-2 rounded-xl bg-white/5 text-white/40 text-sm">取消</button>
              <button onClick={saveGirl} disabled={savingGirl}
                className="px-6 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)' }}>
                {savingGirl ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ImageReview({ pendingImages, setPendingImages, imagesLoaded, setImagesLoaded, token }: any) {
  useEffect(() => {
    if (imagesLoaded || !token) return
    fetch('/api/admin/images', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setPendingImages(d.items || []); setImagesLoaded(true) })
  }, [token, imagesLoaded])

  async function review(id: number, action: 'approve' | 'reject') {
    await fetch('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ comment_id: id, action }) })
    setPendingImages((prev: any[]) => prev.map(i => i.id === id ? { ...i, images_status: action === 'approve' ? 'approved' : 'rejected' } : i))
  }

  async function deleteOneImage(id: number, url: string) {
    if (!confirm('确定删除这张图片？操作不可撤销。')) return
    const res = await fetch('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ comment_id: id, action: 'delete_one', url }) })
    const data = await res.json()
    if (data.ok) {
      setPendingImages((prev: any[]) => prev.map(i => i.id === id
        ? { ...i, image_urls: i.image_urls.filter((u: string) => u !== url), images_status: data.remaining_count === 0 ? 'none' : i.images_status }
        : i
      ).filter(i => i.images_status !== 'none'))
    }
  }

  if (!imagesLoaded) return <p className="text-white/30 text-sm">加载中...</p>
  const pending = pendingImages.filter((i: any) => i.images_status === 'pending')
  return (
    <div>
      <p className="text-white/30 text-sm mb-4">待审核 {pending.length} · 共 {pendingImages.length} 条</p>
      <div className="flex flex-col gap-4">
        {pendingImages.map((item: any) => (
          <div key={item.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: item.images_status === 'pending' ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: item.images_status === 'pending' ? 'rgba(250,204,21,0.15)' : item.images_status === 'approved' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: item.images_status === 'pending' ? '#facc15' : item.images_status === 'approved' ? '#4ade80' : '#f87171' }}>
                {item.images_status === 'pending' ? '⏳ 待审核' : item.images_status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}
              </span>
              <a href={`/verify/${item.twitter_username}`} target="_blank" className="text-xs text-pink-400">@{item.twitter_username}</a>
              <span className="text-xs text-white/30">{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-white/60 mb-3">{item.content}</p>
            <div className="flex gap-3 mb-3 flex-wrap">
              {(item.image_urls || []).map((url: string, i: number) => (
                <div key={i} className="relative group">
                  <a href={url} target="_blank">
                    <img src={url} alt="" className="w-32 h-32 rounded-xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                  </a>
                  <button
                    onClick={() => deleteOneImage(item.id, url)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
                    title="删除这张图片"
                  >✕</button>
                </div>
              ))}
            </div>
            {item.images_status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => review(item.id, 'approve')} className="px-4 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>✅ 通过</button>
                <button onClick={() => review(item.id, 'reject')} className="px-4 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>❌ 全部拒绝</button>
              </div>
            )}
          </div>
        ))}
        {pendingImages.length === 0 && <p className="text-white/30 text-sm">暂无图片</p>}
      </div>
    </div>
  )
}
