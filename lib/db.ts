import { Pool } from 'pg'

// TLS to the database. Production connections must verify the server's certificate, or
// anyone on the network path could impersonate the database. Hosts like Supabase sign with
// their own CA, so set DATABASE_CA_CERT to that CA certificate (PEM text; "\n" escapes are fine
// for a single-line env var) and the connection is fully verified.
function sslConfig() {
  if (process.env.NODE_ENV !== 'production') return false

  const ca = process.env.DATABASE_CA_CERT
  if (ca) {
    return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true }
  }

  // Until a CA is configured, keep the previous behaviour (encrypted but unverified) rather
  // than take the site down. Set DATABASE_CA_CERT to close this.
  console.warn('DATABASE_CA_CERT is not set: the database connection is encrypted but its certificate is NOT verified.')
  return { rejectUnauthorized: false }
}

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    client.release()
    console.log('Database connected successfully:', result.rows[0])
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Query helper function
export async function query(text: string, params?: any[]) {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: result.rowCount })
    return result
  } catch (error) {
    console.error('Query error:', error)
    throw error
  }
}

// Transaction helper
export async function transaction(callback: (client: any) => Promise<any>) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const db = {
  query,
  transaction,
  pool,
}

export default pool
