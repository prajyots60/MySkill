import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const {courseId} = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Get the current course
    const currentCourse = await prisma.content.findUnique({
      where: { id: courseId },
      select: {
        type: true,
        tags: true,
      },
    })

    if (!currentCourse) {
      return new NextResponse("Course not found", { status: 404 })
    }

    // Find related courses based on type and tags
    const relatedCourses = await prisma.content.findMany({
      where: {
        AND: [
          { id: { not: courseId } }, // Exclude current course
          { isPublished: true }, // Only published courses
          {
            OR: [{ type: currentCourse.type }, { tags: { hasSome: currentCourse.tags } }],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        price: true,
        type: true,
        tags: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
        creator: {
          select: {
            name: true,
            image: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      take: 4, // Limit to 4 related courses
      orderBy: {
        enrollments: {
          _count: "desc",
        },
      },
    })

    // Add rating data to each course
    const coursesWithRatings = relatedCourses.map(course => {
      // Calculate average rating
      const ratings = course.reviews.map(review => review.rating);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0;
        
      return {
        ...course,
        rating: parseFloat(avgRating.toFixed(1)),
        reviewCount: course.reviews.length,
        reviews: undefined, // Remove the raw reviews data
      };
    });

    return NextResponse.json({ courses: coursesWithRatings })
  } catch (error) {
    console.error("[RELATED_COURSES]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}
