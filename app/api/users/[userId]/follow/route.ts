import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { userId } = await params

    const [isFollowing, followerCount] = await Promise.all([
      prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: userId,
          },
        },
      }),
      prisma.userFollow.count({
        where: {
          followingId: userId,
        },
      }),
    ])

    return NextResponse.json({
      isFollowing: !!isFollowing,
      followerCount,
    })
  } catch (error) {
    console.error("[USER_FOLLOW_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const { userId } = await params


    const existingFollow = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    })

    let isFollowing: boolean

    if (existingFollow) {
      await prisma.userFollow.delete({
        where: {
          id: existingFollow.id,
        },
      })
      isFollowing = false
    } else {
      await prisma.userFollow.create({
        data: {
          followerId: session.user.id,
          followingId: userId,
        },
      })
      isFollowing = true
    }

    const followerCount = await prisma.userFollow.count({
      where: {
        followingId: userId,
      },
    })

    return NextResponse.json({
      isFollowing,
      followerCount,
    })
  } catch (error) {
    console.error("[USER_FOLLOW_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
