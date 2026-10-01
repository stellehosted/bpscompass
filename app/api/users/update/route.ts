import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// PUT /api/users/update - Update your own profile (name, grade, department)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { name, grade, department } = body

    // Roles are never self-assigned: they come from club membership, sponsorship and the
    // coordinator list, so `role` in the request is ignored.
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Name must be 1-100 characters' },
          { status: 400 }
        )
      }
      updateFields.push(`name = $${paramIndex++}`)
      values.push(name.trim())
    }
    if (grade !== undefined) {
      updateFields.push(`grade = $${paramIndex++}`)
      values.push(grade)
    }
    if (department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`)
      values.push(department)
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(auth.userId) // Add ID as the last parameter

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, name, role, grade, department, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
