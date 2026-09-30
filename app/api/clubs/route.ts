import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isCoordinator } from '@/lib/auth/roles'
import { permissionsForRoles, rolesFor } from '@/lib/auth/permissions'

// GET /api/clubs - Get all clubs with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isClaimed = searchParams.get('isClaimed')
    const userId = searchParams.get('userId') // For filtering user's clubs

    let query = `
      SELECT 
        c.*,
        u.name as president_name,
        u.email as president_email,
        COUNT(DISTINCT cm.id) as member_count,
        COALESCE(
          (SELECT json_agg(tag) FROM club_tags WHERE club_id = c.id),
          '[]'::json
        ) as tags
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      LEFT JOIN club_members cm ON c.id = cm.club_id
    `

    const conditions: string[] = []
    const params: any[] = []
    let paramCount = 1

    if (isClaimed !== null) {
      conditions.push(`c.is_claimed = $${paramCount}`)
      params.push(isClaimed === 'true')
      paramCount++
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' GROUP BY c.id, u.id ORDER BY c.name ASC'

    const result = await pool.query(query, params)

    // If userId is provided, also check membership and sponsor status
    if (userId) {
      // Check club memberships
      const membershipsQuery = `
        SELECT club_id, role FROM club_members WHERE user_id = $1
      `
      const memberships = await pool.query(membershipsQuery, [userId])
      const membershipMap = new Map(
        memberships.rows.map((m: any) => [m.club_id, m.role])
      )

      // Check club sponsorships
      const sponsorshipsQuery = `
        SELECT club_id FROM club_sponsors WHERE user_id = $1 AND status = 'active'
      `
      const sponsorships = await pool.query(sponsorshipsQuery, [userId])
      const sponsorshipSet = new Set(
        sponsorships.rows.map((s: any) => s.club_id)
      )

      const userIsCoordinator = await isCoordinator(userId)

      const clubs = result.rows.map((club: any) => {
        const isSponsor = sponsorshipSet.has(club.id)
        const isMember = membershipMap.has(club.id)

        return {
          ...club,
          is_joined: isMember || isSponsor, // Sponsors are considered "joined"
          is_sponsor: isSponsor,
          is_coordinator: userIsCoordinator,
          memberRole: isSponsor ? 'sponsor' : (membershipMap.get(club.id) || null),
          // What this viewer may do in this club; the club cards show buttons from this list
          permissions: permissionsForRoles(
            rolesFor({ memberRole: membershipMap.get(club.id), isSponsor, isCoordinator: userIsCoordinator })
          ),
        }
      })

      return NextResponse.json({
        success: true,
        data: clubs,
        count: clubs.length,
      })
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clubs' },
      { status: 500 }
    )
  }
}

// POST /api/clubs - Create a new club (used by the admin dashboard)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, description' },
        { status: 400 }
      )
    }

    // Check if club name already exists
    const checkQuery = 'SELECT id FROM clubs WHERE name = $1'
    const existing = await pool.query(checkQuery, [body.name])
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Club with this name already exists' },
        { status: 409 }
      )
    }

    // Create club
    const insertQuery = `
      INSERT INTO clubs (name, description, image_url, meeting_time, location, is_claimed)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    const result = await pool.query(insertQuery, [
      body.name,
      body.description,
      body.imageUrl || null,
      body.meetingTime || null,
      body.location || null,
      false, // New clubs start unclaimed
    ])

    const club = result.rows[0]

    // Add tags if provided
    if (body.tags && Array.isArray(body.tags) && body.tags.length > 0) {
      const tagInserts = body.tags.map((tag: string) => 
        pool.query('INSERT INTO club_tags (club_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [club.id, tag])
      )
      await Promise.all(tagInserts)
    }

    return NextResponse.json({
      success: true,
      data: club,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating club:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create club' },
      { status: 500 }
    )
  }
}

