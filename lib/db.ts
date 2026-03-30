import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fljdb',
  user: process.env.DB_USER || 'fljuser',
  password: process.env.DB_PASSWORD || 'process.env.DB_PASSWORD',
  max: 10,
  idleTimeoutMillis: 30000,
})

export default pool

// 兼容旧 Supabase 接口的查询帮助函数
export async function dbQuery(sql: string, params: unknown[] = []) {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return { data: result.rows, error: null }
  } catch (err) {
    return { data: null, error: err }
  } finally {
    client.release()
  }
}
