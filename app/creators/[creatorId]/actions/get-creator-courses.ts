"use server"

import { prisma } from "@/lib/db"

export interface CreatorCourse {
  id: string
  title: string
  description?: string
  thumbnail?: string
  price?: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  enrollmentCount: number
  lectureCount: number
  totalDuration?: string
  level?: string
  tags?: string[]
  creatorId: string
  creatorName?: string
  type?: string
  isTrending?: boolean
  rating?: number
  reviewCount?: number
}

export async function getCreatorCourses(
  creatorId: string,
  page: number = 1,
  limit: number = 12,
  tag?: string
): Promise<{
  courses: CreatorCourse[],
  pagination: {
    total: number,
    pages: number,
    currentPage: number
  }
}> {
  try {
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where = {
      creatorId,
      isPublished: true,
      ...(tag ? { tags: { has: tag } } : {})
    };

    // Count total courses for pagination
    const total = await prisma.content.count({ where });
    
    // Fetch the courses
    const courses = await prisma.content.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            enrollments: true,
            reviews: true, // Count reviews for review count
          }
        },
        reviews: {
          select: {
            rating: true,
          }
        },
        sections: {
          include: {
            _count: {
              select: {
                lectures: true
              }
            },
            lectures: {
              select: {
                id: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    });

    // Transform courses data
    const transformedCourses = courses.map(course => {
      // Calculate total lecture count using the sections data
      let lectureCount = 0;
      
      // Direct count of lectures in all sections
      if (course.sections && Array.isArray(course.sections)) {
        // Method 1: Count lectures directly from the included lectures arrays
        lectureCount = course.sections.reduce(
          (acc, section) => acc + (section.lectures?.length || 0), 0
        );
        
        // If that doesn't work, try the _count approach as backup
        if (lectureCount === 0) {
          lectureCount = course.sections.reduce(
            (acc, section) => acc + (section._count?.lectures || 0), 0
          );
        }
      }
      
      // Calculate average rating from reviews
      let averageRating = 0;
      if (course.reviews && course.reviews.length > 0) {
        const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
        averageRating = totalRating / course.reviews.length;
      }
      
      return {
        id: course.id,
        title: course.title,
        description: course.description || undefined,
        thumbnail: course.thumbnail || undefined,
        price: course.price || 0,
        isPublished: course.isPublished,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        enrollmentCount: course._count.enrollments,
        lectureCount,
        // Use undefined for properties that don't exist in the Prisma query type
        totalDuration: undefined, // Set default directly instead of accessing a non-existent property
        level: "Beginner", // Set default value directly
        tags: course.tags as string[] || [],
        creatorId: course.creatorId,
        creatorName: course.creator.name || undefined,
        type: "RECORDED", // Set default value directly
        isTrending: false, // Set default value directly
        rating: averageRating,
        reviewCount: course._count.reviews || 0
      };
    });

    return {
      courses: transformedCourses,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page
      }
    };
  } catch (error) {
    console.error("Error fetching creator courses:", error);
    return {
      courses: [],
      pagination: {
        total: 0,
        pages: 0,
        currentPage: page
      }
    };
  }
}