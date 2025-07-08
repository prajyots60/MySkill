import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Check if a lecture is bookmarked
export async function GET(
  request: NextRequest,
  { params }: { params: { lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Follow Next.js guidance for dynamic route params
    const {lectureId} = await params
    const userId = session.user.id
    
    // Verify that the lecture exists
    const lecture = await prisma.lecture.findUnique({
      where: {
        id: lectureId
      }
    })

    if (!lecture) {
      return NextResponse.json(
        { error: "Lecture not found" },
        { status: 404 }
      )
    }

    // Check if the user has bookmarked the lecture
    const bookmark = await prisma.bookmark.findFirst({
      where: {
        userId,
        lectureId
      }
    })

    return NextResponse.json({ 
      isBookmarked: !!bookmark
    })
  } catch (error) {
    console.error("[LECTURE_BOOKMARK_GET]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

// Toggle bookmark for a lecture
export async function POST(
  request: NextRequest,
  { params }: { params: { lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    // Follow Next.js guidance for dynamic route params
    const lectureId = params.lectureId
    const userId = session.user.id
    
    // Verify that the lecture exists
    const lecture = await prisma.lecture.findUnique({
      where: {
        id: lectureId
      },
      include: {
        section: {
          include: {
            content: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    })

    if (!lecture) {
      return NextResponse.json(
        { error: "Lecture not found" },
        { status: 404 }
      )
    }

    // Check if the user has already bookmarked the lecture
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        userId,
        lectureId
      }
    })

    if (existingBookmark) {
      // Remove the bookmark
      await prisma.bookmark.delete({
        where: {
          id: existingBookmark.id
        }
      })
      
      return NextResponse.json({ 
        message: "Lecture removed from bookmarks", 
        isBookmarked: false 
      })
    } else {
      // Add the bookmark
      await prisma.bookmark.create({
        data: {
          userId,
          lectureId
        }
      })
      
      return NextResponse.json({ 
        message: "Lecture added to bookmarks", 
        isBookmarked: true 
      })
    }
  } catch (error) {
    console.error("[LECTURE_BOOKMARK_POST]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
