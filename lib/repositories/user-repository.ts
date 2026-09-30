import { query, transaction } from '../db'
import { DatabaseUser, UserData, UserUpdateData } from '../types/user'

export class UserRepository {
  /**
   * Upsert user - creates a new user or updates existing one atomically
   * Uses ON CONFLICT to handle both INSERT and UPDATE operations
   */
  async upsertUser(userData: UserData): Promise<DatabaseUser> {
    const {
      email,
      name,
      role = 'student',
      grade,
      department,
    } = userData

    try {
      // Note: We intentionally do NOT update role on conflict - role should only be set
      // on initial user creation or via explicit admin action, not overwritten on login
      const result = await query(
        `INSERT INTO users (email, name, role, grade, department, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           grade = EXCLUDED.grade,
           department = EXCLUDED.department,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, email, name, role, grade, department, created_at, updated_at`,
        [email, name, role, grade, department]
      )

      if (result.rows.length === 0) {
        throw new Error('Failed to upsert user')
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error upserting user:', error)
      throw new Error(`Failed to upsert user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<DatabaseUser | null> {
    try {
      const result = await query(
        'SELECT id, email, name, role, grade, department, created_at, updated_at FROM users WHERE email = $1',
        [email]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error finding user by email:', error)
      throw new Error(`Failed to find user by email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<DatabaseUser | null> {
    try {
      const result = await query(
        'SELECT id, email, name, role, grade, department, created_at, updated_at FROM users WHERE id = $1',
        [id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error finding user by ID:', error)
      throw new Error(`Failed to find user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update user profile data atomically
   */
  async updateUser(id: string, updateData: UserUpdateData): Promise<DatabaseUser> {
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Build dynamic update query based on provided fields
    if (updateData.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      values.push(updateData.name)
    }
    if (updateData.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`)
      values.push(updateData.role)
    }
    if (updateData.grade !== undefined) {
      updateFields.push(`grade = $${paramIndex++}`)
      values.push(updateData.grade)
    }
    if (updateData.department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`)
      values.push(updateData.department)
    }

    if (updateFields.length === 0) {
      throw new Error('No fields provided for update')
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id) // Add ID as the last parameter

    try {
      const result = await query(
        `UPDATE users SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex}
         RETURNING id, email, name, role, grade, department, created_at, updated_at`,
        values
      )

      if (result.rows.length === 0) {
        throw new Error('User not found')
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error updating user:', error)
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute multiple user operations in a single transaction
   */
  async executeInTransaction<T>(callback: (repo: UserRepository) => Promise<T>): Promise<T> {
    return transaction(async (client) => {
      // Create a repository instance that uses the transaction client
      const transactionRepo = new TransactionUserRepository(client)
      return callback(transactionRepo)
    })
  }

  /**
   * Map database row to DatabaseUser interface
   */
  protected mapRowToUser(row: any): DatabaseUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      grade: row.grade,
      department: row.department,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}

/**
 * Transaction-aware UserRepository for use within database transactions
 */
class TransactionUserRepository extends UserRepository {
  constructor(private client: any) {
    super()
  }

  async upsertUser(userData: UserData): Promise<DatabaseUser> {
    const {
      email,
      name,
      role = 'student',
      grade,
      department,
    } = userData

    try {
      const result = await this.client.query(
        `INSERT INTO users (email, name, role, grade, department, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (email) 
         DO UPDATE SET 
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           grade = EXCLUDED.grade,
           department = EXCLUDED.department,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, email, name, role, grade, department, created_at, updated_at`,
        [email, name, role, grade, department]
      )

      if (result.rows.length === 0) {
        throw new Error('Failed to upsert user')
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error upserting user in transaction:', error)
      throw new Error(`Failed to upsert user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async findByEmail(email: string): Promise<DatabaseUser | null> {
    try {
      const result = await this.client.query(
        'SELECT id, email, name, role, grade, department, created_at, updated_at FROM users WHERE email = $1',
        [email]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error finding user by email in transaction:', error)
      throw new Error(`Failed to find user by email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async findById(id: string): Promise<DatabaseUser | null> {
    try {
      const result = await this.client.query(
        'SELECT id, email, name, role, grade, department, created_at, updated_at FROM users WHERE id = $1',
        [id]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      console.error('Error finding user by ID in transaction:', error)
      throw new Error(`Failed to find user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }


}