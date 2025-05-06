import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

export async function POST(request: Request, { params }: { params: { sectionId: string } }) {
  try {
    const { sectionId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to add lectures to this section" },
        { status: 403 },
      )
    }

    // Parse request body
    const { title, description, type, isPreview } = await request.json()

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }

    // Get the highest order and add 1
    const highestOrderLecture = await prisma.lecture.findFirst({
      where: {
        sectionId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const order = highestOrderLecture ? highestOrderLecture.order + 1 : 0

    // Create the lecture in the database
    const lecture = await prisma.lecture.create({
      data: {
        title,
        description,
        type,
        isPreview: isPreview || false,
        order,
        section: {
          connect: { id: sectionId },
        },
      },
    })

    // Invalidate cache
    await redis.del(`course:${section.content.id}`)

    return NextResponse.json({ success: true, lectureId: lecture.id }, { status: 201 })
  } catch (error) {
    console.error("Error creating lecture:", error)
    return NextResponse.json({ success: false, message: "Failed to create lecture" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { sectionId: string } }) {
  try {
    const { sectionId } = params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ message: "You don't have permission to view this section" }, { status: 403 })
    }

    // Get lectures from database
    const lectures = await prisma.lecture.findMany({
      where: {
        sectionId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        documents: true,
      },
    })

    return NextResponse.json({ success: true, lectures })
  } catch (error) {
    console.error("Error getting section lectures:", error)
    return NextResponse.json({ success: false, message: "Failed to get lectures" }, { status: 500 })
  }
}
