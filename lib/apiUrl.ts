/**
 * 自动检测 basePath，给 API fetch 加前缀
 * 主站 /api/xxx → /api/xxx
 * 镜像站 /mirror/api/xxx → /mirror/api/xxx
 */
export function apiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/mirror')) {
    return `/mirror${path}`
  }
  return path
}
