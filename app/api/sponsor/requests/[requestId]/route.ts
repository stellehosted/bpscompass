import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireUser } from "@/lib/auth/session"
import { isSponsorOfClub, isCoordinator } from "@/lib/auth/roles"
import { logAuditAction } from "@/lib/auth/audit"

// POST /api/sponsor/requests/[requestId] - Approve or reject leadership request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { requestId } = await params
    const body = await request.json()
    const { action, rejectionReason } = body

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    // Get the request details
    const requestResult = await pool.query(
      `SELECT * FROM leadership_requests WHERE id = $1`,
      [requestId]
    )

    if (requestResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      )
    }

    const leadershipRequest = requestResult.rows[0]

    if (leadershipRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Request has already been processed" },
        { status: 409 }
      )
    }

    // Verify user is sponsor of the club or coordinator
    const isSponsor = await isSponsorOfClub(userId, leadershipRequest.club_id)
    const isCoord = await isCoordinator(userId)

    if (!isSponsor && !isCoord) {
      return NextResponse.json(
        { success: false, error: "Only sponsors or coordinators can approve/reject requests" },
        { status: 403 }
      )
    }

    await pool.query("BEGIN")

    try {
      if (action === "approve") {
        // Update the request status
        await pool.query(
          `UPDATE leadership_requests 
           SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [userId, requestId]
        )

        // Apply the leadership change
        const { club_id, target_user_id, action_type, new_role } = leadershipRequest
        if (new_role && !['member', 'officer', 'vice_president', 'president'].includes(new_role)) {
          throw new Error('Invalid role on leadership request')
        }

        switch (action_type) {
          case "add_president":
          case "add_officer":
            // Add or update member role
            await pool.query(
              `INSERT INTO club_members (club_id, user_id, role, joined_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (club_id, user_id) 
               DO UPDATE SET role = $3`,
              [club_id, target_user_id, new_role]
            )
            break

          case "remove_president":
          case "remove_officer":
            // Demote to member or remove
            await pool.query(
              `UPDATE club_members SET role = 'member' WHERE club_id = $1 AND user_id = $2`,
              [club_id, target_user_id]
            )
            break
        }

        await pool.query("COMMIT")

        // Log audit action
        await logAuditAction({
          userId,
          action: "approve_leadership_request",
          targetType: "leadership_request",
          targetId: requestId,
          details: `Approved ${action_type} for user ${target_user_id}`,
        })

        return NextResponse.json({
          success: true,
          message: "Leadership request approved and applied successfully",
        })
      } else {
        // Reject the request
        await pool.query(
          `UPDATE leadership_requests 
           SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $2
           WHERE id = $3`,
          [userId, rejectionReason || null, requestId]
        )

        await pool.query("COMMIT")

        // Log audit action
        await logAuditAction({
          userId,
          action: "reject_leadership_request",
          targetType: "leadership_request",
          targetId: requestId,
          details: `Rejected request: ${rejectionReason || "No reason provided"}`,
        })

        return NextResponse.json({
          success: true,
          message: "Leadership request rejected",
        })
      }
    } catch (error) {
      await pool.query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error processing leadership request:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process leadership request" },
      { status: 500 }
    )
  }
}
