import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { Lecture } from "@/lib/types"

export async function GET(req: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { lectureId } = await params
    if (!lectureId) {
      return NextResponse.json({ error: "Lecture ID is required" }, { status: 400 })
    }

    const lecture = (await prisma.lecture.findUnique({
      where: {
        id: lectureId,
      },
      include: {
        section: {
          include: {
            content: {
              select: {
                creatorId: true,
              },
            },
          },
        },
      },
    })) as Lecture & {
      section: {
        content: {
          creatorId: string
        }
      }
    }

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    if (lecture.section.content.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (lecture.type !== "LIVE") {
      return NextResponse.json({ error: "Not a live stream lecture" }, { status: 400 })
    }

    if (!lecture.streamData) {
      return NextResponse.json({ error: "No stream data available" }, { status: 404 })
    }

    console.log(lecture.streamData)
    return NextResponse.json(lecture.streamData)
  } catch (error) {
    console.error("Error fetching stream data:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
