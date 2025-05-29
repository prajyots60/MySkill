import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { revalidatePath } from "next/cache"
import createBatch from "@/lib/utils/db-batch"
import dbMonitoring from "@/lib/db-monitoring"

// GET - Check enrollment status
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const {courseId} = await params // Fixed: Access params directly without awaiting
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }
    
    // First check if we have this in Redis cache
    const cacheKey = `enrollment:${session.user.id}:${courseId}`
    const cachedData = await redis.get(cacheKey)
    
    if (cachedData) {
      const parsedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData
      return NextResponse.json(parsedData)
    }
    
    // Create a batch for related enrollment queries
    const batch = createBatch()
    
    // Check enrollment in a single transaction
    batch.add(tx => tx.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    }))
    
    // If enrolled, get progress statistics in the same transaction
    batch.add(tx => tx.lecture.count({
      where: {
        section: {
          contentId: courseId,
        },
      },
    }))
    
    batch.add(tx => tx.progress.count({
      where: {
        userId: session.user.id,
        isComplete: true,
        lecture: {
          section: {
            contentId: courseId,
          },
        },
      },
    }))
    
    // Execute all queries in a single transaction
    const [enrollment, totalLectures, completedLectures] = await batch.execute()
    
    // Calculate progress percentage
    const progressPercentage = totalLectures > 0 
      ? Math.round((completedLectures / totalLectures) * 100) 
      : 0

    const responseData = {
      success: true,
      isEnrolled: !!enrollment,
      enrollmentDate: enrollment?.createdAt || null, // Using createdAt instead of enrolledAt
      progress: enrollment ? {
        totalLectures,
        completedLectures,
        percentage: progressPercentage
      } : null
    }

    // Cache the response data in Redis
    await redis.set(cacheKey, JSON.stringify(responseData), { ex: 3600 }) // Cache for 1 hour

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error checking enrollment:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('enrollment_check_connection_error')
    }
    
    return NextResponse.json({ success: false, message: "Failed to check enrollment status" }, { status: 500 })
  }
}

// POST - Enroll in a course
export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const courseId = params.courseId
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }
    
    // Create a batch for enrollment operations
    const batch = createBatch()
    
    // Check course existence and enrollment status in a single transaction
    batch.add(tx => tx.content.findUnique({
      where: {
        id: courseId,
        isPublished: true,
      },
    }))
    
    batch.add(tx => tx.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    }))
    
    // Execute the validation queries
    const [course, existingEnrollment] = await batch.execute()

    if (!course) {
      return NextResponse.json({ success: false, message: "Course not found or not available" }, { status: 404 })
    }

    if (existingEnrollment) {
      return NextResponse.json({ success: false, message: "Already enrolled in this course" }, { status: 400 })
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        user: {
          connect: { id: session.user.id },
        },
        content: {
          connect: { id: courseId },
        },
      },
    })

    // Invalidate all relevant caches
    await Promise.all([
      redis.del(`student:enrollments:${session.user.id}`),
      redis.del(`enrollment:${courseId}:${session.user.id}`),
      redis.del(`enrollment:${session.user.id}:${courseId}`),
    ])

    // Revalidate paths
    revalidatePath(`/content/${courseId}`)
    revalidatePath(`/dashboard/student`)
    revalidatePath(`/dashboard/student/my-courses`)

    return NextResponse.json({
      success: true,
      message: "Successfully enrolled in course",
      enrollment,
    })
  } catch (error) {
    console.error("Error enrolling in course:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('enrollment_create_connection_error')
    }
    
    return NextResponse.json({ success: false, message: "Failed to enroll in course" }, { status: 500 })
  }
}

// DELETE - Unenroll from a course
export async function DELETE(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    const { courseId } = params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    try {
      // Use a transaction to handle the deletion of enrollment and progress
      await prisma.$transaction(async (tx) => {
        // First check if enrollment exists
        const existingEnrollment = await tx.enrollment.findFirst({
          where: {
            userId: session.user.id,
            contentId: courseId,
          }
        });

        if (!existingEnrollment) {
          throw new Error("Not enrolled in this course");
        }

        // Delete enrollment using the compound key
        await tx.enrollment.delete({
          where: {
            userId_contentId: {
              userId: session.user.id,
              contentId: courseId,
            }
          }
        });

        // Then delete progress
        await tx.progress.deleteMany({
          where: {
            userId: session.user.id,
            lecture: {
              section: {
                contentId: courseId,
              },
            },
          },
        });
      });

      // Invalidate all relevant caches consistently with POST/GET endpoints
      await Promise.all([
        redis.del(`student:enrollments:${session.user.id}`),
        redis.del(`enrollment:${courseId}:${session.user.id}`),
        redis.del(`enrollment:${session.user.id}:${courseId}`),
      ]);

      // Revalidate paths
      revalidatePath(`/content/${courseId}`);
      revalidatePath(`/dashboard/student`);
      revalidatePath(`/dashboard/student/my-courses`);

      return NextResponse.json({
        success: true,
        message: "Successfully unenrolled from course",
      });
    } catch (txError) {
      if (txError instanceof Error) {
        // Return 404 for "Not enrolled" error, otherwise 500
        const status = txError.message === "Not enrolled in this course" ? 404 : 500;
        throw new Error(txError.message, { cause: { status } });
      }
      throw txError;
    }
  } catch (error) {
    console.error("Error unenrolling from course:", error);
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('enrollment_delete_connection_error');
    }
    
    const status = error instanceof Error && (error as any).cause?.status || 500;
    
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to unenroll from course" 
      }, 
      { status }
    );
  }
}
