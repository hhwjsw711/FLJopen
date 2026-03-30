// 普通 TG 用户积分等级（tg_user tier 专用）
export function getTgUserRank(points: number): string {
  if (points >= 500000) return '正部'
  if (points >= 100000) return '副部'
  if (points >= 50000)  return '正厅'
  if (points >= 20000)  return '副厅'
  if (points >= 10000)  return '正处'
  if (points >= 5000)   return '副处'
  if (points >= 3000)   return '正科'
  if (points >= 1000)   return '副科'
  return '居委会'
}
