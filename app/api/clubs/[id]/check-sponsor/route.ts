import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireUser } from "@/lib/auth/session"

// GET /api/clubs/[id]/check-sponsor - Check if user is already a sponsor of this club
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params

    // Check if user is an active sponsor of this club
    const result = await pool.query(
      `SELECT id FROM club_sponsors 
       WHERE club_id = $1 AND user_id = $2 AND status = 'active' 
       LIMIT 1`,
      [clubId, userId]
    )

    const isSponsor = result.rows.length > 0

    return NextResponse.json({
      success: true,
      isSponsor,
    })
  } catch (error) {
    console.error("Error checking sponsor status:", error)
    return NextResponse.json(
      { success: false, error: "Failed to check sponsor status" },
      { status: 500 }
    )
  }
}
