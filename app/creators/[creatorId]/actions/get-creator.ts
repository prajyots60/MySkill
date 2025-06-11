"use server"

import { prisma } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// Define types for creator profile
export interface CreatorProfile {
  id: string
  name: string
  bio: string
  mobileNumber?: string | null
  image: string
  coverImages?: string[] | null // Changed from coverImage to coverImages array
  tagline?: string | null
  customTitle?: string | null
  expertise?: string[] | null
  location?: string | null
  website?: string | null
  education?: string | null
  achievements?: string | null
  yearsTeaching?: string | null
  languages?: string[] | null
  categories?: string[] | null
  institutionName?: string | null
  institutionDescription?: string | null
  institutionWebsite?: string | null
  themeColor?: string | null
  socialLinks?: {
    twitter?: string
    youtube?: string
    linkedin?: string
    instagram?: string
    facebook?: string
    website?: string
  } | null
  milestones?: Array<{
    title: string
    icon: string
  }> | null
  badges?: Array<{
    title: string
    icon: string
    color: string
  }> | null
  testimonials?: Array<{
    name: string
    title: string
    content: string
    rating: number
    image?: string
  }> | null
  resources?: Array<{
    title: string
    description: string
    url: string
    buttonText: string
  }> | null
  resourcesDescription?: string | null
  customSections?: Array<{
    title: string
    content: string
  }> | null
  showResources?: boolean
  verified?: boolean
  createdAt: Date
  updatedAt: Date
  courseCount: number
  followerCount: number
  studentCount?: number
  averageRating: number
  reviewCount: number
  isOwnProfile?: boolean
}

// Get creator profile data
export async function getCreatorProfile(creatorId: string): Promise<{
  success: boolean
  creator?: CreatorProfile
  error?: string
  isOwnProfile?: boolean
}> {
  try {
    const session = await getServerSession(authOptions)
    const isOwnProfile = session?.user?.id === creatorId

    // Get creator from database
    const user = await prisma.user.findUnique({
      where: { 
        id: creatorId,
        role: "CREATOR" // Ensure we only fetch creators
      },
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        creatorProfile: {
          select: {
            id: true,
            coverImages: true, // Changed from coverImage to coverImages
            tagline: true,
            customTitle: true,
            expertise: true,
            location: true,
            website: true,
            education: true,
            achievements: true,
            yearsTeaching: true,
            languages: true,
            categories: true,
            institutionName: true,
            institutionDescription: true,
            institutionWebsite: true,
            themeColor: true,
            milestones: true,
            badges: true,
            testimonials: true,
            resources: true,
            resourcesDescription: true,
            customSections: true,
            showResources: true,
            verified: true,
            socialLinks: true,
            coverImageIds: true, // Added field for ImageKit file IDs
          }
        },
        _count: {
          select: {
            contents: true, // Count of courses
            followers: { where: { follower: { role: "STUDENT" } } } // Count of followers who are students
          }
        },
        contents: {
          select: {
            _count: {
              select: {
                enrollments: true, // Count enrollments for each course
                reviews: true // Count reviews for each course
              }
            },
            reviews: {
              select: {
                rating: true // Get all ratings to calculate average
              }
            }
          }
        }
      }
    })

    if (!user) {
      return { success: false, error: "Creator not found" }
    }

    // Calculate total student count from course enrollments
    const totalStudents = user.contents.reduce((total, course) => {
      return total + course._count.enrollments;
    }, 0);

    // Calculate average rating across all courses
    let totalRatings = 0;
    let totalReviews = 0;
    let averageRating = 0;

    user.contents.forEach(course => {
      // Count all reviews
      const courseReviewCount = course._count.reviews || 0;
      totalReviews += courseReviewCount;

      // Sum all ratings
      if (course.reviews && course.reviews.length > 0) {
        const courseRatingSum = course.reviews.reduce((sum, review) => sum + review.rating, 0);
        totalRatings += courseRatingSum;
      }
    });

    // Calculate average if there are any reviews
    if (totalReviews > 0) {
      averageRating = totalRatings / totalReviews;
    }

    // Transform data to match expected format
    const creator: CreatorProfile = {
      id: user.id,
      name: user.name || "",
      bio: user.bio || "",
      mobileNumber: user.mobileNumber || "",
      image: user.image || "",
      coverImages: user.creatorProfile?.coverImages, // Changed from coverImage to coverImages
      tagline: user.creatorProfile?.tagline,
      customTitle: user.creatorProfile?.customTitle,
      expertise: user.creatorProfile?.expertise,
      location: user.creatorProfile?.location,
      website: user.creatorProfile?.website,
      education: user.creatorProfile?.education,
      achievements: user.creatorProfile?.achievements,
      yearsTeaching: user.creatorProfile?.yearsTeaching,
      languages: user.creatorProfile?.languages,
      categories: user.creatorProfile?.categories,
      institutionName: user.creatorProfile?.institutionName,
      institutionDescription: user.creatorProfile?.institutionDescription,
      institutionWebsite: user.creatorProfile?.institutionWebsite,
      themeColor: user.creatorProfile?.themeColor || "default",
      socialLinks: user.creatorProfile?.socialLinks as CreatorProfile["socialLinks"],
      milestones: user.creatorProfile?.milestones as CreatorProfile["milestones"],
      badges: user.creatorProfile?.badges as CreatorProfile["badges"],
      testimonials: user.creatorProfile?.testimonials as CreatorProfile["testimonials"],
      resources: user.creatorProfile?.resources as CreatorProfile["resources"],
      resourcesDescription: user.creatorProfile?.resourcesDescription,
      customSections: user.creatorProfile?.customSections as CreatorProfile["customSections"],
      showResources: user.creatorProfile?.showResources || false,
      verified: user.creatorProfile?.verified || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      courseCount: user._count.contents,
      followerCount: user._count.followers,
      studentCount: totalStudents, // Add the accurate student count here
      averageRating: averageRating,
      reviewCount: totalReviews,
      isOwnProfile,
      coverImageIds: user.creatorProfile?.coverImageIds,
    }

    return { success: true, creator, isOwnProfile }
  } catch (error) {
    console.error("Error fetching creator profile:", error)
    return { success: false, error: "Failed to fetch creator profile" }
  }
}

// Define input type for the updateCreatorProfile function
interface UpdateCreatorProfileInput {
  name?: string
  bio?: string
  mobileNumber?: string
  image?: string
  coverImages?: string[] // Changed from coverImage to coverImages
  tagline?: string
  customTitle?: string
  expertise?: string[]
  location?: string
  website?: string
  education?: string
  achievements?: string
  yearsTeaching?: string
  languages?: string[]
  categories?: string[]
  institutionName?: string
  institutionDescription?: string
  institutionWebsite?: string
  themeColor?: string
  socialLinks?: {
    twitter?: string
    youtube?: string
    linkedin?: string
    instagram?: string
    facebook?: string
    website?: string
  }
  customSections?: Array<{
    title: string
    content: string
  }>
  showResources?: boolean
  resourcesDescription?: string
  resources?: Array<{
    title: string
    description: string
    url: string
    buttonText: string
  }>
}

// Update creator profile data
export async function updateCreatorProfile(
  input: UpdateCreatorProfileInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" }
    }
    
    // Check if user is a creator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, creatorProfile: true }
    })
    
    if (user?.role !== "CREATOR") {
      return { success: false, error: "Only creators can update their profile" }
    }

    // Update user fields
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: input.name,
        bio: input.bio,
        mobileNumber: input.mobileNumber,
        image: input.image
      }
    })

    // Prepare profile data
    const profileData = {
      coverImages: input.coverImages, // Changed from coverImage to coverImages
      tagline: input.tagline,
      customTitle: input.customTitle,
      expertise: input.expertise || [],
      location: input.location,
      website: input.website,
      education: input.education,
      achievements: input.achievements,
      yearsTeaching: input.yearsTeaching,
      languages: input.languages || [],
      categories: input.categories || [],
      institutionName: input.institutionName,
      institutionDescription: input.institutionDescription,
      institutionWebsite: input.institutionWebsite,
      themeColor: input.themeColor,
      socialLinks: input.socialLinks,
      customSections: input.customSections,
      resources: input.resources,
      resourcesDescription: input.resourcesDescription,
      showResources: input.showResources
    }

    // Check if profile exists
    if (user.creatorProfile) {
      // Update existing profile
      await prisma.creatorProfile.update({
        where: { userId: session.user.id },
        data: profileData
      })
    } else {
      // Create new profile
      await prisma.creatorProfile.create({
        data: {
          ...profileData,
          userId: session.user.id
        }
      })
    }

    // Revalidate creator profile page to reflect changes
    revalidatePath(`/creators/${session.user.id}`)
    revalidatePath(`/dashboard/creator/settings`)

    return { success: true }
  } catch (error) {
    console.error("Error updating creator profile:", error)
    return { 
      success: false, 
      error: "Failed to update creator profile. " + (error instanceof Error ? error.message : String(error)) 
    }
  }
}