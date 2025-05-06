/**
 * Cache invalidation utility for creator actions
 * Call these functions when data is modified to ensure cache coherence
 */

import cacheManager from "./cache-manager";

/**
 * Invalidate creator-related caches for a specific user
 */
export function invalidateCreatorCaches(userId: string) {
  // Invalidate the creator's courses list
  cacheManager.invalidate(`creator_courses:${userId}`);
  
  // Invalidate YouTube connection status
  cacheManager.invalidate(`youtube_connection:${userId}`);
  
  console.log(`Invalidated creator caches for user ${userId}`);
}

/**
 * Invalidate course-related caches when a course is updated
 */
export function invalidateCourseCaches(courseId: string, userId: string) {
  // Invalidate the specific course detail
  cacheManager.invalidate(`course_detail:${courseId}:${userId}`);
  
  // Invalidate the course sections
  cacheManager.invalidate(`course_sections:${courseId}:${userId}`);
  
  // Also invalidate the creator's courses list since it contains summary data
  cacheManager.invalidate(`creator_courses:${userId}`);
  
  console.log(`Invalidated course caches for course ${courseId}`);
}

/**
 * Invalidate section-related caches when a section is updated
 */
export function invalidateSectionCaches(courseId: string, userId: string) {
  // Invalidate course sections
  cacheManager.invalidate(`course_sections:${courseId}:${userId}`);
  
  // Invalidate course detail since it contains sections
  cacheManager.invalidate(`course_detail:${courseId}:${userId}`);
  
  console.log(`Invalidated section caches for course ${courseId}`);
}

/**
 * Invalidate lecture-related caches when a lecture is updated
 */
export function invalidateLectureCaches(courseId: string, userId: string) {
  // Lectures are included in sections and course details
  invalidateSectionCaches(courseId, userId);
}