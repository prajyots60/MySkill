import { NextResponse } from "next/server"
import createBatch from "@/lib/utils/db-batch"
import { db } from "@/lib/db"
import dbMonitoring from "@/lib/db-monitoring"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

// Cache duration
const CACHE_DURATION = 60 * 5 // 5 minutes
// Transaction timeout (ms)
const TRANSACTION_TIMEOUT = 5000 // 5 seconds
// Maximum retries
const MAX_RETRIES = 2

export async function GET(
  request: Request,
  { params }: { params: { creatorId: string } }
) {
  try {
    const { creatorId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const tag = searchParams.get("tag") || undefined
    
    // Calculate pagination
    const skip = (page - 1) * limit
    
    // Try batch transaction with retries
    return await executeWithRetry(async (retry) => {
      try {
        // Create a batch for all creator profile queries
        const batch = createBatch({ timeout: TRANSACTION_TIMEOUT })
        
        // Get creator profile
        batch.add(tx => tx.user.findUnique({
          where: { id: creatorId },
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
            socialLinks: true,
            _count: {
              select: {
                contents: true,
                followers: true
              }
            }
          }
        }))
        
        // Get courses with issue in _count.sections.lectures
        batch.add(tx => tx.content.findMany({
          where: {
            creatorId,
            isPublished: true,
            ...(tag ? { tags: { has: tag } } : {})
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            price: true,
            tags: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                enrollments: true
              }
            },
            sections: {
              select: {
                _count: {
                  select: {
                    lectures: true
                  }
                }
              }
            }
          }
        }))
        
        // Get total count for pagination
        batch.add(tx => tx.content.count({
          where: {
            creatorId,
            isPublished: true,
            ...(tag ? { tags: { has: tag } } : {})
          }
        }))
        
        // Get all unique tags used by this creator
        batch.add(tx => tx.content.findMany({
          where: {
            creatorId,
            isPublished: true,
            tags: { isEmpty: false }
          },
          select: {
            tags: true
          }
        }))
        
        // Execute all queries in a single database transaction
        const [creator, courses, totalCourses, tagsData] = await batch.execute()
        
        if (!creator) {
          return NextResponse.json({ error: "Creator not found" }, { status: 404 })
        }
        
        // Process tags data to get unique tags
        const allTags = tagsData.flatMap((content: { tags: string[] }) => content.tags)
        const uniqueTags = [...new Set(allTags)]
        
        // Format courses with additional computed fields
        interface CourseSection {
          _count: {
            lectures: number;
          };
        }

        interface Course {
          id: string;
          title: string;
          description: string;
          thumbnail: string;
          price: number;
          tags: string[];
          createdAt: Date;
          updatedAt: Date;
          _count: {
            enrollments: number;
          };
          sections: CourseSection[];
        }

        interface FormattedCourse extends Omit<Course, '_count' | 'sections'> {
          enrollmentCount: number;
          lectureCount: number;
        }

        const formattedCourses: FormattedCourse[] = courses.map((course: Course) => ({
          ...course,
          enrollmentCount: course._count.enrollments,
          lectureCount: course.sections.reduce((sum, section) => sum + section._count.lectures, 0)
        }));
        
        // Calculate total pages
        const totalPages = Math.ceil(totalCourses / limit)
        
        return NextResponse.json({
          creator: {
            ...creator,
            courseCount: creator._count.contents,
            followerCount: creator._count.followers
          },
          courses: formattedCourses,
          pagination: {
            total: totalCourses,
            totalPages,
            currentPage: page,
            perPage: limit
          },
          availableTags: uniqueTags
        })
        
      } catch (error) {
        // If it's a transaction timeout and we have retries left, retry
        if (
          error instanceof PrismaClientKnownRequestError && 
          error.code === 'P2028' && 
          retry < MAX_RETRIES
        ) {
          console.log(`Transaction timeout, retrying (${retry + 1}/${MAX_RETRIES})...`)
          dbMonitoring.trackError('creator_profile_transaction_retry')
          throw error // Rethrow to trigger retry
        }
        
        // If it's a transaction timeout and we're out of retries, fall back to individual queries
        if (
          error instanceof PrismaClientKnownRequestError && 
          error.code === 'P2028' && 
          retry >= MAX_RETRIES
        ) {
          console.log('Falling back to individual queries...')
          dbMonitoring.trackError('creator_profile_transaction_fallback')
          
          // Execute individual queries instead of transaction
          const [creator, courses, totalCourses, tagsData] = await Promise.all([
            // Creator profile
            db.prisma.user.findUnique({
              where: { id: creatorId },
              select: {
                id: true,
                name: true,
                image: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
                socialLinks: true,
                _count: {
                  select: {
                    contents: true,
                    followers: true
                  }
                }
              }
            }),
            
            // Published courses
            db.prisma.content.findMany({
              where: {
                creatorId,
                isPublished: true,
                ...(tag ? { tags: { has: tag } } : {})
              },
              orderBy: { createdAt: "desc" },
              skip,
              take: limit,
              select: {
                id: true,
                title: true,
                description: true,
                thumbnail: true,
                price: true,
                tags: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    enrollments: true
                  }
                },
                sections: {
                  select: {
                    _count: {
                      select: {
                        lectures: true
                      }
                    }
                  }
                }
              }
            }),
            
            // Total count
            db.prisma.content.count({
              where: {
                creatorId,
                isPublished: true,
                ...(tag ? { tags: { has: tag } } : {})
              }
            }),
            
            // Tags data
            db.prisma.content.findMany({
              where: {
                creatorId,
                isPublished: true,
                tags: { isEmpty: false }
              },
              select: {
                tags: true
              }
            })
          ])
          
          if (!creator) {
            return NextResponse.json({ error: "Creator not found" }, { status: 404 })
          }
          
          // Process tags data to get unique tags
          const allTags = tagsData.flatMap(content => content.tags)
          const uniqueTags = [...new Set(allTags)]
          
          // Format courses with additional computed fields
          const formattedCourses = courses.map(course => ({
            ...course,
            enrollmentCount: course._count.enrollments,
            lectureCount: course.sections.reduce((sum, section) => sum + section._count.lectures, 0)
          }))
          
          // Calculate total pages
          const totalPages = Math.ceil(totalCourses / limit)
          
          return NextResponse.json({
            creator: {
              ...creator,
              courseCount: creator._count.contents,
              followerCount: creator._count.followers
            },
            courses: formattedCourses,
            pagination: {
              total: totalCourses,
              totalPages,
              currentPage: page,
              perPage: limit
            },
            availableTags: uniqueTags
          })
        }
        
        // Any other error, rethrow
        throw error
      }
    })
    
  } catch (error) {
    console.error("Error fetching creator profile:", error)
    
    // Track connection errors
    if (error instanceof Error) {
      if (error.message.includes('connect') || error.message.includes('Connection closed')) {
        dbMonitoring.trackError('creator_profile_connection_error')
      } else if (error.message.includes('transaction')) {
        dbMonitoring.trackError('creator_profile_transaction_error')
      } else {
        dbMonitoring.trackError('creator_profile_unknown_error')
      }
    }
    
    return NextResponse.json(
      { error: "Failed to fetch creator profile" },
      { status: 500 }
    )
  }
}

// Helper function to retry operations
async function executeWithRetry<T>(
  fn: (retry: number) => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries + 1; i++) {
    try {
      return await fn(i)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      
      // If this is the last attempt, don't delay, just propagate the error
      if (i === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(100 * Math.pow(2, i), 1000) + Math.random() * 100
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // This should never happen, but TypeScript requires a return
  throw lastError || new Error("Unexpected error during retry")
}
