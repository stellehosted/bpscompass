import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireUser } from "@/lib/auth/session"
import { logAuditAction } from "@/lib/auth/audit"

// POST /api/clubs/[id]/leave-sponsor - Leave sponsorship of a club (soft delete)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params

    // Check if user is a sponsor
    const sponsorCheck = await pool.query(
      `SELECT id FROM club_sponsors 
       WHERE club_id = $1 AND user_id = $2 AND status = 'active' 
       LIMIT 1`,
      [clubId, userId]
    )

    if (sponsorCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "You are not a sponsor of this club" },
        { status: 404 }
      )
    }

    // Get club name for audit log
    const clubResult = await pool.query(
      `SELECT name FROM clubs WHERE id = $1`,
      [clubId]
    )
    const clubName = clubResult.rows[0]?.name || "Unknown Club"

    // Soft delete: Update status to 'removed'
    await pool.query(
      `UPDATE club_sponsors 
       SET status = 'removed' 
       WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId]
    )

    // Log audit action
    await logAuditAction({
      userId,
      action: "leave_sponsor",
      targetType: "club",
      targetId: clubId,
      details: `Left sponsorship of club: ${clubName}`,
    })

    return NextResponse.json({
      success: true,
      message: "You have left the sponsorship of this club",
    })
  } catch (error) {
    console.error("Error leaving sponsorship:", error)
    return NextResponse.json(
      { success: false, error: "Failed to leave sponsorship" },
      { status: 500 }
    )
  }
}
