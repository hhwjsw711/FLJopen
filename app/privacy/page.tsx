export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-12" style={{ background: '#0a0a0f', color: 'rgba(255,255,255,0.85)', fontFamily: '-apple-system, sans-serif' }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>Last updated: March 2026</p>

        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          This Privacy Policy applies to the FLHUNT Chrome Extension and the flj.info website.
        </p>

        <h2 className="font-bold text-base mb-2">1. Data Collection</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The FLHUNT extension does <strong>not</strong> collect, store, or transmit any personal data.
          The extension only reads the username from the current X (Twitter) URL and fetches
          publicly available reputation data from the flj.info API.
        </p>

        <h2 className="font-bold text-base mb-2">2. Local Storage</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          API responses are cached locally in Chrome storage for up to 1 hour to reduce
          network requests. This data is stored only on your device and is never transmitted
          to any server.
        </p>

        <h2 className="font-bold text-base mb-2">3. Third-Party Services</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The extension fetches data from <strong>flj.info</strong>, which may log standard
          web server access logs (IP address, timestamp, requested URL). No personally
          identifiable information is shared.
        </p>

        <h2 className="font-bold text-base mb-2">4. Permissions</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The extension requests the following permissions:
        </p>
        <ul className="text-sm mb-6 space-y-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <li>• <strong>storage</strong> — to cache API responses locally</li>
          <li>• <strong>x.com / twitter.com</strong> — to detect the current profile username and inject the reputation widget</li>
          <li>• <strong>flj.info</strong> — to fetch account reputation data</li>
        </ul>

        <h2 className="font-bold text-base mb-2">5. Contact</h2>
        <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          For questions about this privacy policy, please visit <a href="https://flj.info" style={{ color: '#f43f8a' }}>flj.info</a>.
        </p>

        <div className="mt-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <a href="/" className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>← 返回首页</a>
        </div>
      </div>
    </div>
  )
}
