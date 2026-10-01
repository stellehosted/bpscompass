import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { hasClubPermission } from '@/lib/auth/club-permissions'

// DELETE /api/posts/[id] - Delete a post (its author, or anyone with the deleteAnyPost permission)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      )
    }

    // Get post details including image URL
    const postQuery = 'SELECT club_id, user_id, image_url FROM posts WHERE id = $1'
    const postResult = await pool.query(postQuery, [postId])

    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    const post = postResult.rows[0]

    // Check if user is the post author
    const isAuthor = post.user_id === userId

    // Everyone else needs the deleteAnyPost permission in this post's club
    if (!isAuthor && !(await hasClubPermission(userId, post.club_id, 'deleteAnyPost'))) {
      return NextResponse.json(
        { success: false, error: "Only the post's author or club leadership can delete this post" },
        { status: 403 }
      )
    }

    // Delete associated image from storage if it exists (skipped when Supabase isn't configured)
    if (post.image_url && supabase) {
      try {
        // Extract filename from URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/club-images/[filename]
        const urlParts = post.image_url.split('/')
        const filename = urlParts[urlParts.length - 1]
        
        if (filename) {
          const { error: deleteError } = await supabase.storage
            .from('club-images')
            .remove([filename])
          
          if (deleteError) {
            console.error('Error deleting image from storage:', deleteError)
            // Continue with post deletion even if image deletion fails
          } else {
            console.log(`Successfully deleted image: ${filename}`)
          }
        }
      } catch (imageError) {
        console.error('Error processing image deletion:', imageError)
        // Continue with post deletion even if image deletion fails
      }
    }

    // Delete the post (this will cascade delete likes due to foreign key constraints)
    await pool.query('DELETE FROM posts WHERE id = $1', [postId])

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}
