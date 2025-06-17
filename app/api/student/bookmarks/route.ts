import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check for cache-busting headers
    const requestHeaders = new Headers(request.headers)
    const shouldBypassCache = 
      requestHeaders.get('X-Cache-Bust') || 
      requestHeaders.get('Cache-Control') === 'no-cache, no-store, must-revalidate' ||
      requestHeaders.get('Pragma') === 'no-cache'
      
    // Try to get from cache if not bypassing
    if (!shouldBypassCache) {
      const cacheKey = `student:bookmarks:${session.user.id}`
      const cachedData = await redis.get(cacheKey)

      if (cachedData) {
        return NextResponse.json({
          success: true,
          bookmarks: JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData)),
          fromCache: true,
        })
      }
    }

    // Get all bookmarked courses
    const bookmarkedCourses = await prisma.content.findMany({
      where: {
        bookmarks: {
          some: {
            userId: session.user.id,
            contentId: {
              not: null
            }
          },
        },
        isPublished: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
        sections: {
          select: {
            _count: {
              select: {
                lectures: true,
              },
            },
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // Get bookmarked lectures
    const bookmarkedLectures = await prisma.bookmark.findMany({
      where: {
        userId: session.user.id,
        lectureId: {
          not: null
        }
      },
      include: {
        lecture: {
          include: {
            section: {
              include: {
                content: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    thumbnail: true,
                    creator: {
                      select: {
                        id: true,
                        name: true,
                        image: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
    
    // Transform the course bookmarks data
    const transformedCourseBookmarks = bookmarkedCourses.map((course) => {
      // Calculate average rating
      const ratings = course.reviews.map(review => review.rating);
      const rating = ratings.length > 0 
        ? parseFloat((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1))
        : 0;
        
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        price: course.price,
        creatorName: course.creator?.name || null,
        creatorImage: course.creator?.image || null,
        enrollmentCount: course._count.enrollments,
        lectureCount: course.sections.reduce((acc, section) => acc + section._count.lectures, 0),
        updatedAt: course.updatedAt,
        level: null, // Handle case where level might be undefined
        tags: course.tags,
        rating: rating,
        reviewCount: ratings.length,
        type: "course"
      }
    })
    
    // Transform the lecture bookmarks data
    const transformedLectureBookmarks = bookmarkedLectures.map((bookmark) => {
      const lecture = bookmark.lecture;
      const course = lecture?.section?.content;
      
      return {
        id: lecture?.id,
        lectureId: lecture?.id,
        lectureTitle: lecture?.title,
        lectureDescription: lecture?.description,
        courseId: course?.id,
        courseTitle: course?.title,
        thumbnail: course?.thumbnail,
        creatorName: course?.creator?.name || null,
        creatorImage: course?.creator?.image || null,
        creatorId: course?.creator?.id,
        duration: lecture?.duration,
        updatedAt: lecture?.updatedAt,
        type: "lecture"
      };
    }).filter(item => item.courseId !== undefined)

    // Combine both types of bookmarks into a single result
    const allBookmarks = {
      courses: transformedCourseBookmarks,
      lectures: transformedLectureBookmarks
    }
    
    // Cache the results if not bypassing cache
    if (!shouldBypassCache) {
      const cacheKey = `student:bookmarks:${session.user.id}`
      await redis.set(cacheKey, JSON.stringify(allBookmarks), { ex: 60 * 5 }) // 5 minutes
    }

    return NextResponse.json({
      success: true,
      bookmarks: allBookmarks,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching bookmarked courses:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch bookmarked courses" }, { status: 500 })
  }
}
