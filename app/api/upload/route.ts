import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabase } from '@/lib/supabase'
import { requireUser } from '@/lib/auth/session'
import { withRateLimit, getClientIdentifier } from '@/lib/security/api-middleware'

// The only image types we store, with the bytes every real file of that type starts with.
// The extension comes from here, never from the client's filename: a public bucket serving a
// client-named .html or .svg file would be a way to host scripts on our storage domain.
const IMAGE_TYPES: Record<string, { extension: string; matches: (b: Uint8Array) => boolean }> = {
  'image/jpeg': { extension: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: 'png', matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/gif': { extension: 'gif', matches: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  'image/webp': {
    extension: 'webp',
    matches: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
}

// POST /api/upload - Handle image uploads using Supabase Storage
async function uploadHandler(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Image storage is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
        { status: 503 }
      )
    }

    // Validate file type
    const imageType = IMAGE_TYPES[file.type]
    if (!imageType) {
      return NextResponse.json(
        { success: false, error: 'File must be a JPEG, PNG, GIF or WebP image' },
        { status: 400 }
      )
    }

    // Validate file size (max 1MB after compression)
    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 1MB. Please compress the image before uploading.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (!imageType.matches(buffer)) {
      return NextResponse.json(
        { success: false, error: 'File contents do not match its image type' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const filename = `club-post-${Date.now()}-${randomUUID().slice(0, 8)}.${imageType.extension}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('club-images')
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to upload to storage' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('club-images')
      .getPublicUrl(filename)

    return NextResponse.json({
      success: true,
      data: {
        filename,
        url: publicUrl,
        size: file.size,
        type: file.type
      }
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 10 uploads per minute, 100 per hour
export const POST = withRateLimit(uploadHandler, 10, 60000)
