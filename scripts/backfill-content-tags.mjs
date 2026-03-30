import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  host: 'localhost',
  database: 'fljdb',
  user: 'fljuser',
  password: 'process.env.DB_PASSWORD',
})

// 权重配置：高概率标签权重 5，普通标签权重 1
const TAGS = [
  { tag: '美腿',  w: 5 },
  { tag: '御姐',  w: 5 },
  { tag: '萝莉',  w: 5 },
  { tag: '黑丝',  w: 5 },
  { tag: '巨乳',  w: 3 },
  { tag: '童颜',  w: 3 },
  { tag: '美臀',  w: 3 },
  { tag: '不露脸', w: 2 },
  { tag: '纯爱',  w: 2 },
  { tag: '情侣',  w: 2 },
  { tag: '熟女',  w: 2 },
  { tag: '多人',  w: 1 },
  { tag: '女同',  w: 1 },
  { tag: 'SM',    w: 1 },
  { tag: '调教',  w: 1 },
  { tag: '4P',    w: 1 },
  { tag: 'NTR',   w: 1 },
  { tag: '小狗',  w: 1 },
]

// 加权随机选 n 个不重复标签
function weightedPick(n) {
  const pool = [...TAGS]
  const result = []
  while (result.length < n && pool.length > 0) {
    const total = pool.reduce((s, t) => s + t.w, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w
      if (r <= 0) {
        result.push(pool[i].tag)
        pool.splice(i, 1)
        break
      }
    }
  }
  return result
}

async function run() {
  // 只处理 score>=40 且 content_tags 为空的账号
  const { rows } = await pool.query(`
    SELECT id FROM girls
    WHERE score >= 40
      AND (content_tags IS NULL OR array_length(content_tags, 1) IS NULL OR array_length(content_tags, 1) = 0)
  `)
  console.log(`找到 ${rows.length} 个账号需要补充标签...`)

  let done = 0
  for (const row of rows) {
    const tags = weightedPick(5)
    await pool.query('UPDATE girls SET content_tags = $1 WHERE id = $2', [tags, row.id])
    done++
    if (done % 100 === 0) console.log(`进度: ${done}/${rows.length}`)
  }
  console.log(`✅ 完成！共更新 ${done} 个账号`)
  await pool.end()
}

run().catch(e => { console.error(e); process.exit(1) })
