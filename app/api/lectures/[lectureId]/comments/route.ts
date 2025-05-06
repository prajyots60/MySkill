import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const { lectureId } = await params

    // Get comments for the lecture
    const comments = await prisma.comment.findMany({
      where: {
        lectureId,
        parentId: null, // Only get top-level comments
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ message: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { lectureId } = params

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { text, parentId } = await request.json()

    if (!text) {
      return NextResponse.json({ message: "Comment text is required" }, { status: 400 })
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        text,
        userId: session.user.id,
        lectureId,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ message: "Failed to create comment" }, { status: 500 })
  }
}
