import { prisma } from "@/lib/db";
import { uploadToWasabi, generateStorageKey, deleteFromWasabi, generatePresignedUploadUrl } from "./wasabi-storage";
import { revalidatePath } from "next/cache";

/**
 * Upload a file for a specific course
 */
export async function uploadCourseFile(
  file: Buffer,
  fileName: string,
  contentType: string,
  courseId: string,
  userId: string,
  category: 'lectures' | 'resources' | 'thumbnails' | 'assignments' | 'other' = 'resources',
  metadata: Record<string, string> = {}
) {
  try {
    // Check if user has permission for this course
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true, id: true, title: true }
    });
    
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check if user is the creator or an admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    if (course.creatorId !== userId && user?.role !== "ADMIN") {
      throw new Error("You don't have permission to upload files to this course");
    }
    
    // Generate a storage key with course ID in the path
    const key = generateStorageKey(
      `courses/${courseId}/${category}`,
      fileName, 
      userId
    );
    
    // Add course information to metadata
    const enhancedMetadata = {
      ...metadata,
      courseId,
      courseTitle: course.title,
      uploadedBy: userId,
      uploadDate: new Date().toISOString(),
    };
    
    // Upload the file to Wasabi
    const uploadResult = await uploadToWasabi(key, file, contentType, enhancedMetadata);
    
    // Create a record in the database
    await prisma.courseResource.create({
      data: {
        title: fileName,
        type: contentType,
        storagePath: key,
        storageProvider: "WASABI",
        url: uploadResult.url,
        sizeInBytes: file.length,
        courseId: courseId,
        uploadedById: userId,
        metadata: enhancedMetadata,
      }
    });
    
    // Revalidate the course page
    revalidatePath(`/content/${courseId}`);
    
    return {
      success: true,
      key,
      url: uploadResult.url,
      fileName,
      contentType,
      sizeInBytes: file.length,
    };
  } catch (error) {
    console.error("Error uploading course file:", error);
    throw error;
  }
}

/**
 * Delete a course file
 */
export async function deleteCourseFile(resourceId: string, userId: string) {
  try {
    // Find the resource with course relationship
    const resource = await prisma.courseResource.findUnique({
      where: { id: resourceId },
      include: {
        course: {
          select: {
            creatorId: true,
          }
        }
      }
    });
    
    if (!resource) {
      throw new Error("Resource not found");
    }
    
    // Check if user has permission to delete
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isCreator = resource.course.creatorId === userId;
    const isAdmin = user?.role === "ADMIN";
    const isResourceUploader = resource.uploadedById === userId;
    
    if (!isCreator && !isAdmin && !isResourceUploader) {
      throw new Error("You don't have permission to delete this resource");
    }
    
    // Delete from Wasabi
    await deleteFromWasabi(resource.storagePath);
    
    // Delete from database
    await prisma.courseResource.delete({
      where: { id: resourceId }
    });
    
    // Revalidate the course page
    revalidatePath(`/content/${resource.courseId}`);
    
    return {
      success: true,
      resourceId,
    };
  } catch (error) {
    console.error("Error deleting course file:", error);
    throw error;
  }
}

/**
 * Get a temporary URL for a course file
 */
export async function getCourseFileUrl(resourceId: string, userId: string, expiresIn = 3600) {
  try {
    // Find the resource
    const resource = await prisma.courseResource.findUnique({
      where: { id: resourceId },
      include: {
        course: {
          select: {
            creatorId: true,
            isPublished: true,
            // Note: isPrivate doesn't exist on Content model based on schema
            // Using tags or other properties to determine privacy
            tags: true,
          }
        }
      }
    });
    
    if (!resource) {
      throw new Error("Resource not found");
    }
    
    // Check if user has permission to access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isCreator = resource.course.creatorId === userId;
    const isAdmin = user?.role === "ADMIN";
    
    // Check if the user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        contentId: resource.courseId, // Using contentId instead of courseId to match model structure
      }
    });
    
    const isEnrolled = !!enrollment;
    
    // Determine if the user can access this resource
    // Using tags to check if content is private: assuming a content with 'private' tag is private
    const isPrivate = resource.course.tags.includes('private');
    
    const canAccess = 
      isCreator || 
      isAdmin || 
      isEnrolled || 
      (resource.course.isPublished && !isPrivate);
    
    if (!canAccess) {
      throw new Error("You don't have permission to access this resource");
    }
    
    // Generate a presigned URL
    // Fixing the expiresIn parameter to match the function signature
    const { url } = await generatePresignedUploadUrl(resource.storagePath, resource.type, {}, expiresIn);
    
    return {
      success: true,
      url,
      resourceId,
      fileName: resource.title,
      contentType: resource.type,
      expiresIn,
    };
  } catch (error) {
    console.error("Error getting course file URL:", error);
    throw error;
  }
}

/**
 * List all resources for a course
 */
export async function listCourseResources(courseId: string, userId: string, category?: string) {
  try {
    // Check if user has permission to view this course
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { 
        creatorId: true, 
        isPublished: true, 
        tags: true, // Using tags instead of isPrivate
        id: true 
      }
    });
    
    if (!course) {
      throw new Error("Course not found");
    }
    
    // Check user permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isCreator = course.creatorId === userId;
    const isAdmin = user?.role === "ADMIN";
    
    // Check if the user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        contentId: course.id, // Using contentId instead of courseId
      }
    });
    
    const isEnrolled = !!enrollment;
    
    // Determine if the user can access this course
    // Using tags to check if content is private
    const isPrivate = course.tags.includes('private');
    
    const canAccess = 
      isCreator || 
      isAdmin || 
      isEnrolled || 
      (course.isPublished && !isPrivate);
    
    if (!canAccess) {
      throw new Error("You don't have permission to access this course");
    }
    
    // Query for resources
    let whereClause: any = { courseId: course.id };
    
    // Filter by category if provided
    if (category) {
      whereClause.storagePath = {
        contains: `courses/${course.id}/${category}/`
      };
    }
    
    const resources = await prisma.courseResource.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        storagePath: true,
        url: true,
        sizeInBytes: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
          }
        },
        metadata: true,
      }
    });
    
    return {
      success: true,
      resources,
      courseId,
      canUpload: isCreator || isAdmin,
    };
  } catch (error) {
    console.error("Error listing course resources:", error);
    throw error;
  }
}
