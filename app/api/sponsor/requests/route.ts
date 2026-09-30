import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { getUserRoles } from "@/lib/auth/roles"

// GET /api/sponsor/requests - Get all pending leadership requests for sponsored clubs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      )
    }

    // Get user roles to determine access
    const roles = await getUserRoles(userId)

    let query = ""
    let params: any[] = []

    if (roles.isCoordinator) {
      // Coordinators see all pending requests
      query = `
        SELECT 
          lr.*,
          c.name as club_name,
          c.image_url as club_image,
          requester.name as requester_name,
          requester.email as requester_email,
          target.name as target_name,
          target.email as target_email
        FROM leadership_requests lr
        JOIN clubs c ON lr.club_id = c.id
        JOIN users requester ON lr.requested_by = requester.id
        JOIN users target ON lr.target_user_id = target.id
        WHERE lr.status = 'pending'
        ORDER BY lr.created_at DESC
      `
    } else {
      // Sponsors see only requests for their clubs
      query = `
        SELECT 
          lr.*,
          c.name as club_name,
          c.image_url as club_image,
          requester.name as requester_name,
          requester.email as requester_email,
          target.name as target_name,
          target.email as target_email
        FROM leadership_requests lr
        JOIN clubs c ON lr.club_id = c.id
        JOIN club_sponsors cs ON c.id = cs.club_id
        JOIN users requester ON lr.requested_by = requester.id
        JOIN users target ON lr.target_user_id = target.id
        WHERE cs.user_id = $1 AND cs.status = 'active' AND lr.status = 'pending'
        ORDER BY lr.created_at DESC
      `
      params = [userId]
    }

    const result = await pool.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Error fetching leadership requests:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch leadership requests" },
      { status: 500 }
    )
  }
}
