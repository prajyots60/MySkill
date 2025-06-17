import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Get like count for a lecture
export async function GET(
  request: NextRequest,
  { params }: { params: { lectureId: string } }
) {
  try {
    const lectureId = params.lectureId
    
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

    // Get the count of likes for this lecture
    const likeCount = await prisma.lectureLike.count({
      where: {
        lectureId
      }
    })

    // Check if the current user has liked the lecture
    const session = await getServerSession(authOptions)
    let isLiked = false

    if (session?.user?.id) {
      const userLike = await prisma.lectureLike.findFirst({
        where: {
          userId: session.user.id,
          lectureId
        }
      })
      isLiked = !!userLike
    }

    return NextResponse.json({ 
      count: likeCount, 
      isLiked 
    })
  } catch (error) {
    console.error("[LECTURE_LIKES_GET]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

// Toggle like for a lecture
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
    
    const lectureId = params.lectureId
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

    // Check if the user has already liked the lecture
    const existingLike = await prisma.lectureLike.findFirst({
      where: {
        userId,
        lectureId
      }
    })

    if (existingLike) {
      // Unlike the lecture
      await prisma.lectureLike.delete({
        where: {
          id: existingLike.id
        }
      })
      
      // Get new count
      const newCount = await prisma.lectureLike.count({
        where: {
          lectureId
        }
      })
      
      return NextResponse.json({ 
        message: "Lecture unliked successfully", 
        isLiked: false,
        count: newCount
      })
    } else {
      // Like the lecture
      await prisma.lectureLike.create({
        data: {
          userId,
          lectureId
        }
      })
      
      // Get new count
      const newCount = await prisma.lectureLike.count({
        where: {
          lectureId
        }
      })
      
      return NextResponse.json({ 
        message: "Lecture liked successfully", 
        isLiked: true,
        count: newCount
      })
    }
  } catch (error) {
    console.error("[LECTURE_LIKES_POST]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
