'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { T, getLang, setLangStorage, type Lang } from '@/lib/i18n'
import { apiUrl } from '@/lib/apiUrl'

// ── 城市地区分组 ──
const REGION_CITIES: Record<string, { label: string; flag: string; keywords: string[] }> = {
  japan: {
    label: '日本', flag: '🇯🇵',
    keywords: ['東京','大阪','京都','名古屋','横浜','札幌','福岡','仙台','神戸','埼玉','千葉','広島','奈良','新宿','渋谷','六本木','池袋','新大阪','難波','梅田','心斎橋','栄','中区','博多','天神']
  },
  mainland: {
    label: '大陆', flag: '🇨🇳',
    keywords: ['上海','北京','深圳','广州','杭州','成都','武汉','南京','重庆','天津','苏州','西安','长沙','青岛','厦门','东莞','广州','广东','上海','北京']
  },
  taiwan: {
    label: '台湾', flag: '🇹🇼',
    keywords: ['台北','高雄','台中','台南','基隆','新竹','桃园','台灣','台湾','Taipei','Kaohsiung']
  },
  overseas: {
    label: '其他', flag: '🌍',
    keywords: ['美國','美国','USA','英国','UK','韩国','韓国','澳大利亚','加拿大','法国','德国','新加坡','马来西亚','泰国','越南','Europe','Australia']
  },
}

function getCityRegion(city: string): string | null {
  for (const [region, { keywords }] of Object.entries(REGION_CITIES)) {
    if (keywords.some(k => city.includes(k) || k.includes(city))) return region
  }
  return 'overseas'
}

interface TgUser { id: string; username?: string; first_name: string; photo_url?: string }

interface RankItem {
  twitter_username: string; display_name: string | null; avatar_url: string | null
  score: number; is_fushi: boolean; has_threshold: boolean; negative_tags: string[]; score_detail: any
  account_language?: string | null
}
interface RankCategory { id: string; label: string; items: RankItem[] }

const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh', label: '简中' },
  { id: 'zh-tw', label: '繁中' },
  { id: 'ja', label: '日文' },
  { id: 'en', label: 'EN' },
]

// ── 主题色定义 ──
const THEMES = {
  dark: {
    bg: '#0e0e10',
    headerBorder: 'rgba(255,255,255,0.05)',
    inputBg: 'rgba(255,255,255,0.06)',
    inputBorder: 'rgba(255,255,255,0.1)',
    inputFocus: '#f43f8a55',
    textPrimary: '#ffffff',
    textMuted: 'rgba(255,255,255,0.35)',
    textFaint: 'rgba(255,255,255,0.15)',
    textFooter: 'rgba(255,255,255,0.45)',
    accent: 'linear-gradient(135deg,#f43f8a,#e0368c)',
    accentSolid: '#f43f8a',
    accentBg: 'rgba(244,63,138,0.12)',
    accentText: '#f43f8a',
    logoGradient: 'linear-gradient(135deg,#f43f8a,#fb923c)',
    btnLang: 'rgba(244,63,138,0.2)',
    btnLangText: '#f43f8a',
    tagBg: 'rgba(244,63,138,0.1)',
    tgBtn: '#2AABEE',
  },
  yellow: {
    bg: '#1a1a1a',
    headerBorder: 'rgba(255,153,0,0.15)',
    inputBg: 'rgba(255,153,0,0.07)',
    inputBorder: 'rgba(255,153,0,0.2)',
    inputFocus: '#ff990055',
    textPrimary: '#ffffff',
    textMuted: 'rgba(255,255,255,0.5)',
    textFaint: 'rgba(255,255,255,0.2)',
    textFooter: 'rgba(255,255,255,0.55)',
    accent: 'linear-gradient(135deg,#ff9900,#ffb347)',
    accentSolid: '#ff9900',
    accentBg: 'rgba(255,153,0,0.15)',
    accentText: '#ff9900',
    logoGradient: 'linear-gradient(135deg,#ff9900,#ffb347)',
    btnLang: 'rgba(255,153,0,0.2)',
    btnLangText: '#ff9900',
    tagBg: 'rgba(255,153,0,0.1)',
    tgBtn: '#ff9900',
  },
  light: {
    bg: '#f5f5f0',
    headerBorder: 'rgba(0,0,0,0.08)',
    inputBg: 'rgba(0,0,0,0.04)',
    inputBorder: 'rgba(0,0,0,0.12)',
    inputFocus: '#f43f8a44',
    textPrimary: '#111111',
    textMuted: 'rgba(0,0,0,0.5)',
    textFaint: 'rgba(0,0,0,0.3)',
    textFooter: 'rgba(0,0,0,0.55)',
    accent: 'linear-gradient(135deg,#f43f8a,#e0368c)',
    accentSolid: '#f43f8a',
    accentBg: 'rgba(244,63,138,0.1)',
    accentText: '#e0368c',
    logoGradient: 'linear-gradient(135deg,#f43f8a,#fb923c)',
    btnLang: 'rgba(244,63,138,0.15)',
    btnLangText: '#e0368c',
    tagBg: 'rgba(244,63,138,0.08)',
    tgBtn: '#2AABEE',
  },
}

type Theme = keyof typeof THEMES

export default function Home() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('zh')
  const [theme, setTheme] = useState<Theme>('dark')
  const [showSettings, setShowSettings] = useState(false)
  useEffect(() => {
    setLang(getLang())
    const saved = localStorage.getItem('flj_theme') as Theme | null
    if (saved && saved in THEMES) setTheme(saved)
  }, [])
  const c = THEMES[theme]
  const t = T[lang]
  const [tgUser, setTgUser] = useState<TgUser | null>(null)
  const [loginErr, setLoginErr] = useState('')
  const [username, setUsername] = useState('')
  const [rankings, setRankings] = useState<RankCategory[]>([])
  const [cities, setCities] = useState<{ city: string; count: number }[]>([])
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [openRegion, setOpenRegion] = useState<string | null>(null)
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [cityItems, setCityItems] = useState<RankItem[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const [selectedLang, setSelectedLang] = useState<'zh' | 'ja' | 'en' | null>(null)

  function matchesLang(item: RankItem, lang: 'zh' | 'ja' | 'en'): boolean {
    const l = (item.account_language || item.score_detail?.primary_language || '').toLowerCase()
    if (lang === 'zh') return l.includes('中') || l.includes('zh')
    if (lang === 'ja') return l.includes('日') || l === 'ja' || l.startsWith('ja')
    if (lang === 'en') return l.includes('en') || l.includes('英')
    return true
  }

  const loadRankingsData = () => {
    fetch(apiUrl('/api/rankings/overview')).then(r => r.json()).then(d => { if (Array.isArray(d)) setRankings(d) }).catch(() => {})
    fetch(apiUrl('/api/rankings/cities')).then(r => r.json()).then(d => { if (Array.isArray(d)) setCities(d) }).catch(() => {})
  }

  useEffect(() => {
    loadRankingsData()
    // 记录 PV
    const tgToken = localStorage.getItem('flj_tg_token') || ''
    fetch('/api/stats/pv', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tgToken}` },
      body: JSON.stringify({ path: '/' })
    }).catch(() => {})

    // bfcache 恢复时重新拉数据（浏览器返回键导致的数据丢失）
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) loadRankingsData() }
    window.addEventListener('pageshow', onPageShow)

    // 在线人数统计 Ping
    const ping = () => {
      const token = localStorage.getItem('flj_tg_token') || ''
      fetch('/api/ping', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {})
    }
    ping(); const timer = setInterval(ping, 30000)

    return () => {
      window.removeEventListener('pageshow', onPageShow)
      clearInterval(timer)
    }
  }, [])

  function selectCity(city: string | null) {
    setSelectedCity(city)
    if (!city) { setCityItems([]); return }
    setCityLoading(true)
    fetch(apiUrl(`/api/rankings?city=${encodeURIComponent(city)}&page=1`))
      .then(r => r.json()).then(d => setCityItems(d.items || []))
      .finally(() => setCityLoading(false))
  }

  useEffect(() => {
    const saved = localStorage.getItem('flj_tg_user')
    const token = localStorage.getItem('flj_tg_token')
    if (saved && token) setTgUser(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tgToken = params.get('tg_token')
    const tgUserParam = params.get('tg_user')
    const tgErr = params.get('tg_err')
    if (tgToken && tgUserParam) {
      try {
        const user = JSON.parse(decodeURIComponent(tgUserParam))
        localStorage.setItem('flj_tg_token', tgToken)
        localStorage.setItem('flj_tg_user', JSON.stringify(user))
        setTgUser(user)
      } catch {}
      window.history.replaceState({}, '', '/')
    }
    if (tgErr) {
      const reason = params.get('reason') || ''
      const keys = params.get('keys') || ''
      if (tgErr === 'not_member') setLoginErr('未加入频道')
      else if (tgErr === 'expired') setLoginErr('登录已过期，请重试')
      else setLoginErr(`登录失败(${reason}${keys ? ' keys:'+keys : ''})`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  function switchTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('flj_theme', t)
  }

  function switchLang(l: Lang) {
    setLang(l)
    setLangStorage(l)
  }

  function logout() {
    localStorage.removeItem('flj_tg_token')
    localStorage.removeItem('flj_tg_user')
    setTgUser(null)
  }

  function handleVerify() {
    const u = username.replace('@', '').trim()
    if (!u) return
    // 检测非法字符（中文、emoji、空格等）
    if (/[^a-zA-Z0-9_]/.test(u)) {
      alert(lang === 'ja'
        ? 'X(Twitter)のユーザー名は英数字とアンダースコアのみです。\nプロフィールの@マークの後の部分を入力してください。'
        : lang === 'en'
        ? 'X username only contains letters, numbers and underscores.\nPlease enter the part after @ on their profile.'
        : '请输入 @ 后面的英文用户名，不是昵称！\nX 用户名只含英文字母、数字和下划线。')
      return
    }
    window.location.href = `/verify/${u}?lang=${lang}&source=search`
  }

  const themeButtons: { id: Theme; icon: string; label: string }[] = [
    { id: 'dark', icon: '🌙', label: '暗色' },
    { id: 'yellow', icon: '🟡', label: '黄黑' },
    { id: 'light', icon: '☀️', label: '亮色' },
  ]

  return (
    <main className="min-h-screen" style={{ background: c.bg, transition: 'background 0.3s' }}>
      {/* 顶部导航栏 */}
      <header className="px-4 lg:px-12" style={{ borderBottom: `1px solid ${c.headerBorder}` }}>
        <div className="max-w-5xl mx-auto py-3">
          {/* 第一行：Logo + 登录按钮 */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold" style={{ color: c.accentText }}>福利鉴</span>
              <span className="text-[10px]" style={{ color: c.textFaint }}>.info</span>
            </div>

            {/* TG 登录 / 已登录用户 */}
            <div className="flex items-center gap-2">
            <a href="/sponsor" className="text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{ color: 'rgba(250,204,21,0.8)', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', whiteSpace: 'nowrap' }}>
              支持本站
            </a>
            {tgUser ? (
              <div className="flex items-center gap-2">
                {tgUser.photo_url && <img src={tgUser.photo_url} className="w-7 h-7 rounded-full" />}
                <span className="text-xs hidden sm:block" style={{ color: c.textMuted }}>{tgUser.first_name}</span>
                <button onClick={logout}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all"
                  style={{ color: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.08)' }}>
                  退出
                </button>
              </div>
            ) : (
              <a href="/tg-widget.html"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: c.tgBtn, color: 'white', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/></svg>
                登录
              </a>
            )}
            </div>
          </div>

          {/* 第二行：设置按钮 + 爆料广场 */}
          <div className="flex items-center gap-2 relative">
            {/* 设置按钮 */}
            <button onClick={() => setShowSettings(s => !s)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
              style={{ background: showSettings ? c.accentBg : 'rgba(128,128,128,0.1)', color: showSettings ? c.accentText : c.textMuted, border: `1px solid ${showSettings ? c.accentSolid+'44' : 'transparent'}` }}>
              <span>{themeButtons.find(tb => tb.id === theme)?.icon}</span>
              <span>{LANGS.find(l => l.id === lang)?.label}</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>{showSettings ? '▲' : '▼'}</span>
            </button>

            {/* 下拉面板 */}
            {showSettings && (
              <div className="absolute top-full left-0 mt-1.5 rounded-xl p-3 z-50 shadow-xl"
                style={{ background: theme === 'light' ? '#ffffff' : theme === 'yellow' ? '#1a1400' : '#1a1a22', border: `1px solid ${(c as any).cardBorder}`, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: c.textFaint }}>主题</p>
                <div className="flex gap-1 mb-3">
                  {themeButtons.map(tb => (
                    <button key={tb.id} onClick={() => { switchTheme(tb.id) }}
                      className="flex-1 rounded-lg py-1 text-sm transition-all"
                      style={{ background: theme === tb.id ? c.accentBg : 'rgba(128,128,128,0.1)', outline: theme === tb.id ? `1px solid ${c.accentSolid}44` : 'none' }}
                      title={tb.label}>{tb.icon}</button>
                  ))}
                </div>
                <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: c.textFaint }}>语言</p>
                <div className="flex gap-1">
                  {LANGS.map(l => (
                    <button key={l.id} onClick={() => { switchLang(l.id); setShowSettings(false) }}
                      className="flex-1 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: lang === l.id ? c.btnLang : 'rgba(128,128,128,0.1)', color: lang === l.id ? c.btnLangText : c.textMuted, border: lang === l.id ? `1px solid ${c.accentSolid}44` : `1px solid transparent` }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="w-px h-4" style={{ background: c.headerBorder }} />

            {/* 爆料广场入口 */}
            <a href="/boom"
              className="text-xs font-semibold px-2.5 py-0.5 rounded-lg transition-all hover:opacity-80"
              style={{ color: '#f43f8a', background: 'rgba(244,63,138,0.1)', border: '1px solid rgba(244,63,138,0.2)', whiteSpace: 'nowrap' }}>
              爆料广场
            </a>
          </div>
        </div>
      </header>

      {/* 中央搜索区 */}
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        {/* 统计数据条 */}
        <SiteStatsBar lang={lang} theme={theme} c={c} />

        {/* Hero */}
        <div className="text-center pt-8 pb-10">
          <h1 className="text-3xl lg:text-4xl font-bold mb-3" style={{ color: c.textPrimary }}>{t.tagline}</h1>
          <p className="text-sm" style={{ color: c.textMuted }}>{t.subtitle}</p>
        </div>

        {/* 搜索框 */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-3.5 transition-colors"
              style={{ background: c.inputBg, border: `1px solid ${c.inputBorder}` }}>
              <span className="font-mono" style={{ color: c.textFaint }}>@</span>
              <input
                className="flex-1 bg-transparent outline-none"
                style={{ color: c.textPrimary }}
                placeholder={t.placeholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <button onClick={handleVerify}
              className="px-6 py-3.5 rounded-2xl font-semibold transition-opacity"
              style={{
                background: c.accent,
                color: 'white',
                cursor: 'pointer',
                opacity: 1
              }}>
              {t.btn_verify}
            </button>
          </div>
          <p className="text-xs text-center mt-3" style={{ color: c.textFaint }}>{t.wait_hint}</p>

          {/* 登录提示（仅游客，小字） */}
          {!tgUser && (
            <p className="text-xs text-center mt-4" style={{ color: c.textFaint }}>
              💬 {lang === 'ja' ? 'ログインすると評価・コメントが可能' : lang === 'en' ? 'Log in to vote & comment' : '登录后可参与评分和评论'}
            </p>
          )}
        </div>
      </div>

      {/* 地区 + 语言筛选栏 */}
      {cities.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-4">
          <div className="flex items-center gap-2">
            {/* 📍 地区按钮 */}
            <button
              onClick={() => setOpenRegion(openRegion === 'drawer' ? null : 'drawer')}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition-all flex-shrink-0"
              style={{
                background: selectedCity ? c.accentBg : (theme==='light'?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.08)'),
                color: selectedCity ? c.accentText : c.textMuted,
                border: selectedCity ? `1px solid ${c.accentSolid}44` : `1px solid ${c.headerBorder}`
              }}>
              <span>📍</span>
              <span>{selectedCity || (lang==='ja' ? '地域' : lang==='en' ? 'Area' : '地区')}</span>
              {selectedCity && <button onClick={e => { e.stopPropagation(); selectCity(null) }} style={{ color: c.accentText, marginLeft: 2 }}>✕</button>}
              {!selectedCity && <span className="text-[10px]" style={{ opacity: 0.4 }}>{openRegion === 'drawer' ? '▲' : '▼'}</span>}
            </button>

            {/* 分隔线 */}
            <div className="w-px h-4 flex-shrink-0" style={{ background: c.headerBorder }} />

            {/* 语言筛选 */}
            {([
              { id: 'zh', label: '🇨🇳 中文' },
              { id: 'ja', label: '🇯🇵 日语' },
              { id: 'en', label: '🇬🇧 英文' },
            ] as { id: 'zh' | 'ja' | 'en'; label: string }[]).map(({ id, label }) => (
              <button key={id}
                onClick={() => setSelectedLang(selectedLang === id ? null : id)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all flex-shrink-0"
                style={{
                  background: selectedLang === id ? c.accentBg : 'transparent',
                  color: selectedLang === id ? c.accentText : c.textMuted,
                  border: selectedLang === id ? `1px solid ${c.accentSolid}44` : `1px solid transparent`
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* 地区抽屉（展开后向下铺开） */}
          {openRegion === 'drawer' && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ background: theme==='light'?'rgba(0,0,0,0.03)':'rgba(255,255,255,0.04)', border: `1px solid ${c.headerBorder}` }}>
              {/* 全部 */}
              <button onClick={() => { selectCity(null); setOpenRegion(null) }}
                className="w-full text-left px-3 py-1.5 text-xs font-medium transition-all"
                style={{ color: !selectedCity ? c.accentText : c.textMuted, background: !selectedCity ? c.accentBg : 'transparent', borderBottom: `1px solid ${c.headerBorder}` }}>
                🌏 {lang==='ja' ? 'すべて' : lang==='en' ? 'All' : '全部'}
              </button>

              {/* 各地区分组（二级折叠） */}
              {Object.entries(REGION_CITIES).map(([regionId, region]) => {
                const regionCities = cities.filter(({ city }) => getCityRegion(city) === regionId)
                if (regionCities.length === 0) return null
                const isExpanded = expandedRegion === regionId
                return (
                  <div key={regionId} style={{ borderBottom: `1px solid ${c.headerBorder}` }}>
                    {/* 地区标题（可点击展开/折叠） */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 transition-all"
                      style={{ background: isExpanded ? c.accentBg : 'transparent', border: 'none', cursor: 'pointer' }}
                      onClick={() => setExpandedRegion(isExpanded ? null : regionId)}>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 11, fontWeight: 700, color: isExpanded ? c.accentText : c.textMuted }}>{region.flag} {region.label}</span>
                        <span style={{ fontSize: 9, color: c.textFaint, opacity: 0.5 }}>({regionCities.length})</span>
                      </div>
                      <span style={{ fontSize: 9, color: c.textFaint, opacity: 0.5 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {/* 城市 grid（仅展开时显示） */}
                    {isExpanded && (
                      <div className="px-2 pb-2 grid grid-cols-4 gap-1">
                        {regionCities.map(({ city, count }) => (
                          <button key={city}
                            onClick={() => { selectCity(city); setOpenRegion(null); setExpandedRegion(null) }}
                            className="text-center transition-all truncate"
                            style={{
                              fontSize: 11, padding: '3px 4px', borderRadius: 6,
                              background: selectedCity===city ? c.accentBg : (theme==='light'?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.06)'),
                              color: selectedCity===city ? c.accentText : c.textMuted,
                              border: selectedCity===city ? `1px solid ${c.accentSolid}44` : `1px solid transparent`
                            }}>
                            {city}<span style={{ opacity: 0.35, fontSize: 9 }}> {count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 排行榜区块 */}
      {rankings.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-16">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold" style={{ color: c.textPrimary }}>
              {selectedCity ? `📍 ${selectedCity}` : t.rankings_title}
            </h2>
            {!selectedCity && <a href="/rankings" className="text-xs transition-opacity hover:opacity-80" style={{ color: c.accentText }}>{t.rankings_view_all}</a>}
          </div>
          {!selectedCity && (
            <div className="rounded-xl px-4 py-3 mb-5 text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: c.textMuted }}>
              <p className="mb-1">{t.rankings_desc}</p>
              <p className="font-medium tracking-wide whitespace-nowrap overflow-x-auto scrollbar-hide" style={{ color: c.textPrimary, opacity: 0.75 }}>{t.rankings_icons}</p>
            </div>
          )}

          {/* 城市筛选结果 */}
          {selectedCity ? (
            cityLoading ? (
              <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"/></div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {cityItems.filter(item => !selectedLang || matchesLang(item, selectedLang)).map(item => {
                  const tags: string[] = item.score_detail?.account_tags || []
                  const isFushi = item.is_fushi || tags.includes('風俗業者')
                  const hasThreshold = item.has_threshold || tags.includes('有门槛费')
                  const hasComplaint = (item.negative_tags || []).length > 0
                  const isAV = tags.includes('AV女優')
                  const isWelfare = tags.includes('福利博主')
                  const scoreColor = item.score >= 62 ? '#4ade80' : item.score >= 38 ? '#facc15' : '#f87171'
                  
                  // 语言标识
                  const lang = item.account_language || item.score_detail?.primary_language || ''
                  const langFlag = lang.includes('中') || lang.toLowerCase().includes('zh') ? '🇨🇳' : 
                                  lang.includes('日') || lang.toLowerCase().includes('ja') ? '🇯🇵' : 
                                  lang.toLowerCase().includes('en') || lang.toLowerCase().includes('英') ? '🇬🇧' : ''

                  const isManualVerified = item.score_detail?.is_manual_verified
                  return (
                    <div key={item.twitter_username}
                      onClick={() => { window.location.href = `/verify/${item.twitter_username}?source=rankings` }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all"
                      style={{ background: theme==='light'?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)', border: `1px solid ${c.headerBorder}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme==='light'?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = theme==='light'?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)')}>
                      <div className="relative flex-shrink-0">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} className="w-10 h-10 rounded-full object-cover" style={{ border: `1px solid ${c.headerBorder}` }} />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: c.accentBg }}>{(item.display_name||item.twitter_username)[0]?.toUpperCase()}</div>
                        )}
                        {isManualVerified && <span className="absolute -bottom-0.5 -right-0.5 text-[11px] leading-none">🔵</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-1" style={{ color: c.textPrimary }}>
                          {item.display_name || `@${item.twitter_username}`}
                          {langFlag && <span className="text-xs grayscale-[0.2] opacity-80" title={lang}>{langFlag}</span>}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] truncate" style={{ color: c.textFaint }}>@{item.twitter_username}</span>
                          {isFushi && <span className="text-[9px] px-1 rounded-full" style={{ background:'rgba(139,92,246,0.2)',color:'#a78bfa' }}>🔞</span>}
                          {hasThreshold && <span className="text-[9px] px-1 rounded-full" style={{ background:'rgba(245,158,11,0.15)',color:'#fbbf24' }}>🚪</span>}
                          {isAV && <span className="text-[9px] px-1 rounded-full" style={{ background:'rgba(236,72,153,0.15)',color:'#f472b6' }}>🎬</span>}
                          {isWelfare && <span className="text-[9px] px-1 rounded-full" style={{ background:'rgba(251,146,60,0.15)',color:'#fb923c' }}>📦</span>}
                          {hasComplaint && <span className="text-[9px] px-1 rounded-full" style={{ background:'rgba(239,68,68,0.15)',color:'#f87171' }}>🚨</span>}
                        </div>
                      </div>
                      <div className="rounded-md px-1.5 py-0.5 flex-shrink-0" style={{ background:`${scoreColor}18`, border:`1px solid ${scoreColor}44` }}>
                        <span className="text-sm font-black font-mono" style={{ color: scoreColor }}>{item.score}</span>
                      </div>
                    </div>
                  )
                })}
                {cityItems.filter(item => !selectedLang || matchesLang(item, selectedLang)).length === 0 && (
                  <p className="text-sm col-span-full py-8 text-center" style={{ color: c.textFaint }}>
                    {selectedLang ? '该语言暂无数据' : '暂无数据'}
                  </p>
                )}
              </div>
            )
          ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {rankings.map(cat => {
              const catLabel = (t as any)[`cat_${cat.id}`] || cat.label
              return (
              <div key={cat.id} className="rounded-2xl overflow-hidden"
                style={{ background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${c.headerBorder}` }}>
                {/* 卡片头 */}
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${c.headerBorder}`, background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)' }}>
                  <span className="text-sm font-bold" style={{ color: c.textPrimary }}>{catLabel}</span>
                  <a href={`/rankings?cat=${cat.id}`} className="text-[10px] transition-opacity hover:opacity-70" style={{ color: c.accentText }}>{t.rankings_all}</a>
                </div>
                {/* 列表 TOP 5 */}
                <div className="py-1">
                  {cat.items.filter(item => !selectedLang || matchesLang(item, selectedLang)).slice(0, 5).map((item, idx) => {
                    const tags: string[] = item.score_detail?.account_tags || []
                    const isFushi = item.is_fushi || tags.includes('風俗業者')
                    const hasThreshold = item.has_threshold || tags.includes('有门槛费')
                    const hasComplaint = (item.negative_tags || []).length > 0
                    const isAV = tags.includes('AV女優')
                    const isWelfare = tags.includes('福利博主')
                    const scoreColor = item.score >= 62 ? '#4ade80' : item.score >= 38 ? '#facc15' : '#f87171'

                    // 语言标识
                    const lang = item.account_language || item.score_detail?.primary_language || ''
                    const langFlag = lang.includes('中') || lang.toLowerCase().includes('zh') ? '🇨🇳' : 
                                    lang.includes('日') || lang.toLowerCase().includes('ja') ? '🇯🇵' : 
                                    lang.toLowerCase().includes('en') || lang.toLowerCase().includes('英') ? '🇬🇧' : ''

                    return (
                      <div key={item.twitter_username}
                        onClick={() => { window.location.href = `/verify/${item.twitter_username}?source=rankings` }}
                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-xl mx-1 transition-all"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {/* 排名 */}
                        <span className="text-xs font-black w-4 text-center flex-shrink-0"
                          style={{ color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : c.textFaint }}>
                          {idx < 3 ? ['①','②','③'][idx] : idx + 1}
                        </span>
                        {/* 头像 */}
                        <div className="relative flex-shrink-0">
                          {item.avatar_url ? (
                            <img src={item.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: `1px solid ${c.headerBorder}` }} />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                              style={{ background: c.accentBg, border: `1px solid ${c.accentSolid}33` }}>
                              {(item.display_name || item.twitter_username)[0]?.toUpperCase()}
                            </div>
                          )}
                          {item.score_detail?.is_manual_verified && <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">🔵</span>}
                        </div>
                        {/* 名称+标签 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate flex items-center gap-1" style={{ color: c.textPrimary }}>
                            {item.display_name || `@${item.twitter_username}`}
                            {langFlag && <span className="text-[10px] grayscale-[0.2] opacity-70">{langFlag}</span>}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] truncate" style={{ color: c.textFaint }}>@{item.twitter_username}</span>
                            {isFushi && <span className="text-[8px] px-1 rounded-full flex-shrink-0" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>🔞</span>}
                            {hasThreshold && <span className="text-[8px] px-1 rounded-full flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>🚪</span>}
                            {isAV && <span className="text-[8px] px-1 rounded-full flex-shrink-0" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>🎬</span>}
                            {isWelfare && <span className="text-[8px] px-1 rounded-full flex-shrink-0" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>📦</span>}
                            {hasComplaint && <span className="text-[8px] px-1 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>🚨</span>}
                          </div>
                        </div>
                        {/* 评分 */}
                        <div className="rounded-md px-1.5 py-0.5 flex-shrink-0" style={{ background: `${scoreColor}18`, border: `1px solid ${scoreColor}44` }}>
                          <span className="text-xs font-black font-mono" style={{ color: scoreColor }}>{item.score}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })}
          </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-sm" style={{ borderTop: `1px solid ${c.headerBorder}`, color: c.textFooter }}>
        <p style={{ fontSize: 11, lineHeight: 1.7, opacity: 0.5, maxWidth: 400, margin: '0 auto 10px' }}>{t.footer}</p>
        <p>
          <a href="https://x.com/iam678" target="_blank" rel="noopener noreferrer"
            className="font-semibold transition-opacity hover:opacity-80"
            style={{ color: c.accentText, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            produced by @iam678
          </a>
        </p>
        <p className="mt-2 flex items-center justify-center gap-4 flex-wrap">
          <a href="/rankings" style={{ color: c.textFaint, fontSize: 11 }}>🏆 排行榜</a>
          <span style={{ color: c.textFaint, fontSize: 11, opacity: 0.3 }}>·</span>
          <a href="/byok" style={{ color: c.textFaint, fontSize: 11 }}>🔑 自助检索</a>
          <span style={{ color: c.textFaint, fontSize: 11, opacity: 0.3 }}>·</span>
          <a href="/flhunt" style={{ color: c.textFaint, fontSize: 11 }}>🔍 FLHUNT 插件</a>
          <span style={{ color: c.textFaint, fontSize: 11, opacity: 0.3 }}>·</span>
          <a href="/privacy" style={{ color: c.textFaint, fontSize: 11 }}>隐私政策</a>
        </p>
      </footer>
    </main>
  )
}

// ── 统计数据条 ──
function SiteStatsBar({ lang, theme, c }: { lang: string; theme: string; c: any }) {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch('/api/stats/site')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  const items = stats ? [
    {
      label: lang === 'ja' ? '本日新規' : lang === 'en' ? 'new today' : '今日新收录',
      value: stats.today_new?.toLocaleString() ?? '—',
    },
    {
      label: lang === 'ja' ? '総収録' : lang === 'en' ? 'total' : '收录福利姬数',
      value: stats.total_girls?.toLocaleString() ?? '—',
    },
    {
      label: lang === 'ja' ? '優良アカウント' : lang === 'en' ? 'quality' : '优质账号',
      value: stats.trusted_count?.toLocaleString() ?? '—',
    },
    {
      label: lang === 'ja' ? '本日閲覧' : lang === 'en' ? "today's views" : '今日总检索',
      value: stats.today_pv?.toLocaleString() ?? '—',
    },
  ] : Array(4).fill(null)

  return (
    <div className="flex items-center justify-center gap-4 mt-6 mb-0 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="text-[11px] whitespace-nowrap" style={{ color: c.textMuted }}>
          {item
            ? <>{item.label} <span style={{ color: c.accentText, fontWeight: 700 }}>{item.value}</span></>
            : <span className="inline-block w-16 h-3 rounded animate-pulse align-middle" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }} />
          }
        </span>
      ))}
    </div>
  )
}


