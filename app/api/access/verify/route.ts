import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get("contentId")

    if (!contentId) {
      return NextResponse.json({ message: "Content ID is required" }, { status: 400 })
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId,
      },
    })

    // Check if the content is free or the user is the creator
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        creatorId: true,
        price: true,
        isPublished: true,
      },
    })

    if (!content) {
      return NextResponse.json({ message: "Content not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN" 

    // Check if content is published
    if (!content.isPublished && !isCreator && !isAdmin) {
      return NextResponse.json({ message: "Content is not published" }, { status: 403 })
    }

    // Check if user has access
    const isFree = content.price === 0 || content.price === null
    const hasAccess = enrollment || isFree || isCreator || isAdmin

    if (!hasAccess) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 })
    }

    return NextResponse.json(
      {
        hasAccess: true,
        isCreator,
        isAdmin,
        isFree,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error verifying access:", error)
    return NextResponse.json({ message: "Failed to verify access" }, { status: 500 })
  }
}
