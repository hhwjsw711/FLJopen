export default function FlhuntPage() {
  return (
    <div className="min-h-screen px-4 py-12" style={{ background: '#0a0a0f', color: '#fff', fontFamily: '-apple-system, sans-serif' }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'rgba(244,63,138,0.15)', border: '1px solid rgba(244,63,138,0.3)' }}>
            <span className="text-2xl font-black" style={{ color: '#f43f8a' }}>FL</span>
          </div>
          <h1 className="text-3xl font-black mb-2">FLHUNT</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Chrome 浏览器插件 · 在 X (Twitter) 上直接查看账号可信度评分
          </p>
        </div>

        {/* 效果说明 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-bold text-sm mb-3">✨ 功能介绍</h2>
          <div className="space-y-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <p>• 浏览 X 主页时自动弹出可信度评分（0-200分）</p>
            <p>• 显示正/负面标签、内容类型标签</p>
            <p>• 未收录账号提示风险，可一键跳转分析</p>
            <p>• 本地缓存1小时，不影响正常浏览速度</p>
            <p>• 不收集任何个人数据</p>
          </div>
        </div>

        {/* 下载 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(244,63,138,0.06)', border: '1px solid rgba(244,63,138,0.2)' }}>
          <h2 className="font-bold text-sm mb-1">📦 下载安装包</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>Chrome 商店审核中，目前可手动安装体验版</p>
          <a href="/flhunt-extension.zip" download
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
            style={{ background: 'rgba(244,63,138,0.15)', color: '#f43f8a', border: '1px solid rgba(244,63,138,0.3)' }}>
            ⬇ 下载 FLHUNT.zip
          </a>
        </div>

        {/* 安装步骤 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-bold text-sm mb-4">🔧 安装步骤</h2>
          <div className="space-y-4">
            {[
              ['①', '下载并解压 ZIP 文件', '得到 flj-extension 文件夹'],
              ['②', '打开 Chrome 扩展管理页', '地址栏输入 chrome://extensions'],
              ['③', '开启「开发者模式」', '右上角开关打开'],
              ['④', '加载插件', '点「加载已解压的扩展程序」→ 选择 flj-extension 文件夹'],
              ['⑤', '去 X 试用', '打开任意 X 用户主页，右下角会自动显示评分'],
            ].map(([step, title, desc]) => (
              <div key={step} className="flex gap-3">
                <span className="text-base font-bold shrink-0" style={{ color: '#f43f8a' }}>{step}</span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部 */}
        <div className="text-center text-xs space-y-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <p>Chrome 商店审核通过后可一键安装，无需手动操作</p>
          <a href="/" style={{ color: 'rgba(255,255,255,0.3)' }}>← 返回首页</a>
        </div>

      </div>
    </div>
  )
}
