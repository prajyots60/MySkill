import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth" 
import { db } from "@/lib/db"
import dbMonitoring from "@/lib/db-monitoring"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"
import { Enrollment, Content, Bookmark } from "@prisma/client"

// Maximum retry attempts for database operations
const MAX_RETRIES = 3
// Timeout for individual queries in milliseconds
const QUERY_TIMEOUT = 5000

/**
 * Retry function for database operations with exponential backoff
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retries <= 0 || !isPrismaTimeoutError(error)) {
      throw error
    }
    
    // Log retry attempt
    console.log(`Retrying operation, ${retries} attempts left`)
    
    // Exponential backoff
    const delay = Math.pow(2, MAX_RETRIES - retries) * 100
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Retry with one fewer retry available
    return retryOperation(operation, retries - 1)
  }
}

/**
 * Check if the error is a Prisma transaction timeout error
 */
function isPrismaTimeoutError(error: any): boolean {
  return (
    error instanceof PrismaClientKnownRequestError && 
    (error.code === 'P2028' || error.message.includes('transaction'))
  )
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const userId = session.user.id
    let dashboardData: any = {
      enrollments: [],
      inProgress: [],
      stats: {
        totalCourses: 0,
        completedCourses: 0,
        bookmarkCount: 0
      }
    }
    
    // Define type for the enrollment results to avoid 'unknown' type issues
    type EnrollmentWithContent = Enrollment & {
      content: Content & {
        creator: {
          id: string;
          name: string | null;
          image: string | null;
        };
        sections: Array<{
          lectures: Array<{
            id: string;
            progress: Array<{
              isComplete: boolean;
              percentage: number;
            }>;
          }>;
        }>;
      };
    };

    // Fetch data with individual queries and retry logic instead of a single transaction
    try {
      // Get recent enrollments with course details and progress
      const recentEnrollments = await retryOperation<EnrollmentWithContent[]>(() => db.prisma.enrollment.findMany({
        where: { userId },
        orderBy: { enrolledAt: "desc" },
        take: 6,
        include: {
          content: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              },
              sections: {
                include: {
                  lectures: {
                    select: {
                      id: true,
                      progress: {
                        where: { userId },
                        select: {
                          isComplete: true,
                          percentage: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }))
      
      // Process enrollments to calculate progress
      dashboardData.enrollments = recentEnrollments.map((enrollment: EnrollmentWithContent) => {
        const content = enrollment.content
        
        // Calculate total lectures
        let totalLectures = 0
        let completedLectures = 0
        
        content.sections.forEach((section: {lectures: Array<{id: string; progress: Array<{isComplete: boolean; percentage: number}>}> }) => {
          section.lectures.forEach((lecture: {id: string; progress: Array<{isComplete: boolean; percentage: number}>}) => {
            totalLectures++
            if (lecture.progress[0]?.isComplete) {
              completedLectures++
            }
          })
        })
        
        // Calculate overall progress percentage
        const progressPercentage = totalLectures > 0
          ? Math.round((completedLectures / totalLectures) * 100)
          : 0
        
        return {
          id: enrollment.id,
          enrolledAt: enrollment.enrolledAt,
          content: {
            id: content.id,
            title: content.title,
            thumbnail: content.thumbnail,
            type: content.type,
            creator: content.creator
          },
          progress: {
            percentage: progressPercentage,
            completedLectures,
            totalLectures
          }
        }
      })
    } catch (error) {
      console.error("Error fetching recent enrollments:", error)
      dbMonitoring.trackError('student_dashboard_enrollments_error')
      // Continue with other queries even if this one fails
    }
    
    try {
      // Get in-progress courses (optimized query)
      dashboardData.inProgress = await retryOperation(() => db.prisma.enrollment.findMany({
        where: {
          userId,
          content: {
            sections: {
              some: {
                lectures: {
                  some: {
                    progress: {
                      some: {
                        userId,
                        isComplete: false,
                        percentage: {
                          gt: 0
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        take: 4,
        orderBy: {
          // Using lastAccessed which should exist on the Enrollment model
          // If this doesn't exist, you may need to use another field like enrolledAt
          enrolledAt: "desc" 
        },
        include: {
          content: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }))
    } catch (error) {
      console.error("Error fetching in-progress courses:", error)
      dbMonitoring.trackError('student_dashboard_inprogress_error')
      // Continue with other queries
    }
    
    // Fetch stats with parallel execution and individual error handling
    await Promise.allSettled([
      // Get total course count
      retryOperation(() => db.prisma.enrollment.count({ where: { userId } }))
        .then(count => { dashboardData.stats.totalCourses = count })
        .catch(error => {
          console.error("Error counting total courses:", error)
          dbMonitoring.trackError('student_dashboard_total_courses_error')
        }),
      
      // Get completed courses count (optimized query)
      retryOperation(() => db.prisma.content.count({
        where: {
          enrollments: {
            some: { userId }
          },
          sections: {
            every: {
              lectures: {
                every: {
                  progress: {
                    some: {
                      userId,
                      isComplete: true
                    }
                  }
                }
              }
            }
          }
        }
      }))
        .then(count => { dashboardData.stats.completedCourses = count })
        .catch(error => {
          console.error("Error counting completed courses:", error)
          dbMonitoring.trackError('student_dashboard_completed_courses_error')
        }),
      
      // Get bookmark count
      retryOperation(() => db.prisma.bookmark.count({ where: { userId } }))
        .then(count => { dashboardData.stats.bookmarkCount = count })
        .catch(error => {
          console.error("Error counting bookmarks:", error)
          dbMonitoring.trackError('student_dashboard_bookmarks_error')
        })
    ])
    
    return NextResponse.json(dashboardData)
    
  } catch (error) {
    console.error("Error fetching student dashboard:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('student_dashboard_connection_error')
    } else {
      dbMonitoring.trackError('student_dashboard_unknown_error')
    }
    
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}