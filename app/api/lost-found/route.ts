import { NextRequest, NextResponse } from 'next/server'

// Mock database - in production, replace with actual database
let lostFoundItems: any[] = [
  {
    id: "1",
    title: "Black iPhone 14",
    description: "Black iPhone 14 with a clear case. Has a small crack on the bottom left corner. Last seen in the cafeteria during lunch.",
    category: "electronics",
    type: "lost",
    location: "Cafeteria",
    dateReported: "2024-01-15T10:30:00Z",
    contactName: "Sarah Johnson",
    contactEmail: "sarah.j@school.edu",
    contactPhone: "(555) 123-4567",
    image: null,
    status: "active",
    reporter: {
      name: "Sarah Johnson",
    },
  },
  {
    id: "2",
    title: "Blue Nike Backpack",
    description: "Found a blue Nike backpack in the gym locker room. Contains some textbooks and a water bottle.",
    category: "accessories",
    type: "found",
    location: "Gym Locker Room",
    dateReported: "2024-01-16T14:20:00Z",
    contactName: "Mike Chen",
    contactEmail: "mike.c@school.edu",
    image: null,
    status: "active",
    reporter: {
      name: "Mike Chen",
    },
  }
]

// GET /api/lost-found - Get all lost and found items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'active'

    let filteredItems = lostFoundItems.filter(item => item.status === status)

    // Filter by category
    if (category && category !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === category)
    }

    // Filter by type
    if (type && type !== 'all') {
      filteredItems = filteredItems.filter(item => item.type === type)
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase()
      filteredItems = filteredItems.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.location.toLowerCase().includes(searchLower)
      )
    }

    // Sort by date (newest first)
    filteredItems.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime())

    return NextResponse.json({
      success: true,
      data: filteredItems,
      count: filteredItems.length
    })
  } catch (error) {
    console.error('Error fetching lost and found items:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST /api/lost-found - Create a new lost and found item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['title', 'description', 'category', 'type', 'location', 'contactName', 'contactEmail']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate category
    const validCategories = ['electronics', 'clothing', 'books', 'accessories', 'keys', 'other']
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['lost', 'found'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type' },
        { status: 400 }
      )
    }

    // Create new item
    const newItem = {
      id: Date.now().toString(),
      title: body.title,
      description: body.description,
      category: body.category,
      type: body.type,
      location: body.location,
      dateReported: new Date().toISOString(),
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone || null,
      image: body.image || null,
      status: 'active',
      reporter: {
        name: body.contactName,
      }
    }

    // Add to mock database
    lostFoundItems.unshift(newItem)

    return NextResponse.json({
      success: true,
      data: newItem
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating lost and found item:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
