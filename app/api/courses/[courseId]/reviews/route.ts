import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Define interfaces for the SQL query results
interface ReviewStats {
  averageRating: number | null;
  totalReviews: string | number;
  fiveStarCount: string | number;
  fourStarCount: string | number;
  threeStarCount: string | number;
  twoStarCount: string | number;
  oneStarCount: string | number;
}

// GET - Get reviews for a course
export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const { courseId } = await params
    
    // Check if course exists
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        isPublished: true,
      },
      select: {
        id: true,
      },
    })

    if (!course) {
      return NextResponse.json({ success: false, message: "Course not found" }, { status: 404 })
    }

    // Get all reviews for the course with user info
    const reviews = await prisma.review.findMany({
      where: {
        contentId: courseId,
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
      orderBy: {
        createdAt: "desc",
      },
    })
    
    // Get review statistics
    const stats = await prisma.$queryRaw<ReviewStats[]>`
      SELECT 
        AVG(rating)::float as "averageRating",
        COUNT(*)::text as "totalReviews",
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)::text as "fiveStarCount",
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)::text as "fourStarCount",
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)::text as "threeStarCount",
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)::text as "twoStarCount",
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::text as "oneStarCount"
      FROM "Review"
      WHERE "contentId" = ${courseId}
    `
    
    // Format stats with percentages
    const formattedStats = {
      averageRating: parseFloat((stats[0]?.averageRating?.toFixed(1) as string) || "0"),
      totalReviews: parseInt(String(stats[0]?.totalReviews) || "0"),
      distribution: {
        5: {
          count: parseInt(String(stats[0]?.fiveStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fiveStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        4: {
          count: parseInt(String(stats[0]?.fourStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fourStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        3: {
          count: parseInt(String(stats[0]?.threeStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.threeStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        2: {
          count: parseInt(String(stats[0]?.twoStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.twoStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        1: {
          count: parseInt(String(stats[0]?.oneStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.oneStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        }
      }
    }

    // Get user's own review if authenticated
    let userReview = null
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      userReview = await prisma.review.findUnique({
        where: {
          userId_contentId: {
            userId: session.user.id,
            contentId: courseId,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      reviews,
      stats: formattedStats,
      userReview,
    })
  } catch (error) {
    console.error("Error fetching course reviews:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch reviews" }, { status: 500 })
  }
}

// POST - Create or update a review
export async function POST(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_contentId: {
          userId: session.user.id,
          contentId: courseId,
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json({ 
        success: false, 
        message: "You must be enrolled in the course to leave a review" 
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { rating, comment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: "Rating is required and must be between 1-5" }, { status: 400 })
    }

    // Check if review already exists for this user and course
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_contentId: {
          userId: session.user.id,
          contentId: courseId,
        },
      },
    })

    let review
    if (existingReview) {
      // Update existing review
      review = await prisma.review.update({
        where: {
          id: existingReview.id,
        },
        data: {
          rating,
          comment,
        },
      })
    } else {
      // Create new review
      review = await prisma.review.create({
        data: {
          rating,
          comment,
          user: {
            connect: { id: session.user.id },
          },
          content: {
            connect: { id: courseId },
          },
        },
      })
    }

    // Invalidate all related cached data
    await Promise.all([
      redis.del(`course:${courseId}:reviews`),
      redis.del(`course:${courseId}`) // Also clear the main course cache
    ])
    
    // Get updated stats to return with the response
    const stats = await prisma.$queryRaw<ReviewStats[]>`
      SELECT 
        AVG(rating)::float as "averageRating",
        COUNT(*)::text as "totalReviews",
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)::text as "fiveStarCount",
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)::text as "fourStarCount",
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)::text as "threeStarCount",
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)::text as "twoStarCount",
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::text as "oneStarCount"
      FROM "Review"
      WHERE "contentId" = ${courseId}
    `
    
    // Format stats with percentages
    const formattedStats = {
      averageRating: parseFloat((stats[0]?.averageRating?.toFixed(1) as string) || "0"),
      totalReviews: parseInt(String(stats[0]?.totalReviews) || "0"),
      distribution: {
        5: {
          count: parseInt(String(stats[0]?.fiveStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fiveStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        4: {
          count: parseInt(String(stats[0]?.fourStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fourStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        3: {
          count: parseInt(String(stats[0]?.threeStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.threeStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        2: {
          count: parseInt(String(stats[0]?.twoStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.twoStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        1: {
          count: parseInt(String(stats[0]?.oneStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.oneStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      review,
      stats: formattedStats,
      isUpdate: !!existingReview,
    })
  } catch (error) {
    console.error("Error creating/updating review:", error)
    return NextResponse.json({ success: false, message: "Failed to save review" }, { status: 500 })
  }
}

// DELETE - Delete a review
export async function DELETE(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_contentId: {
          userId: session.user.id,
          contentId: courseId,
        },
      },
    })

    if (!existingReview) {
      return NextResponse.json({ success: false, message: "Review not found" }, { status: 404 })
    }

    // Delete the review
    await prisma.review.delete({
      where: {
        id: existingReview.id,
      },
    })

    // Invalidate all related cached data
    await Promise.all([
      redis.del(`course:${courseId}:reviews`),
      redis.del(`course:${courseId}`) // Also clear the main course cache
    ])
    
    // Get updated stats to return with the response
    const stats = await prisma.$queryRaw<ReviewStats[]>`
      SELECT 
        AVG(rating)::float as "averageRating",
        COUNT(*)::text as "totalReviews",
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)::text as "fiveStarCount",
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)::text as "fourStarCount",
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)::text as "threeStarCount",
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)::text as "twoStarCount",
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::text as "oneStarCount"
      FROM "Review"
      WHERE "contentId" = ${courseId}
    `
    
    // Format stats with percentages
    const formattedStats = {
      averageRating: parseFloat((stats[0]?.averageRating?.toFixed(1) as string) || "0"),
      totalReviews: parseInt(String(stats[0]?.totalReviews) || "0"),
      distribution: {
        5: {
          count: parseInt(String(stats[0]?.fiveStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fiveStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        4: {
          count: parseInt(String(stats[0]?.fourStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.fourStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        3: {
          count: parseInt(String(stats[0]?.threeStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.threeStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        2: {
          count: parseInt(String(stats[0]?.twoStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.twoStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        },
        1: {
          count: parseInt(String(stats[0]?.oneStarCount) || "0"),
          percentage: parseInt(String(stats[0]?.totalReviews)) > 0 
            ? Math.round((parseInt(String(stats[0]?.oneStarCount) || "0") / parseInt(String(stats[0]?.totalReviews))) * 100) 
            : 0
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      stats: formattedStats
    })
  } catch (error) {
    console.error("Error deleting review:", error)
    return NextResponse.json({ success: false, message: "Failed to delete review" }, { status: 500 })
  }
}
