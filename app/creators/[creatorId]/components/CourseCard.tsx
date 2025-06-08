"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { ExtendedCourse } from "../types/creator.types"
import { OptimizedCourseCard } from "@/components/optimized-course-card"

interface CourseCardProps {
  course: ExtendedCourse;
  themeColor?: string;
  creator?: any; // Add creator prop
}

const CourseCard: React.FC<CourseCardProps> = ({ course, themeColor = "default", creator }) => {
  const router = useRouter()
  
  // Get the creator's name either from the course data or from the creator profile context
  const instructorName = course.creatorName || (creator?.name) || "";

  // Format the data to match what OptimizedCourseCard expects
  return (
    <OptimizedCourseCard
      id={course.id}
      title={course.title}
      description={course.description}
      thumbnailUrl={course.thumbnail || ""}
      authorName={instructorName}
      authorImage={creator?.image || ""}
      enrollmentCount={course.enrollmentCount || 0}
      updatedAt={new Date(course.updatedAt || new Date())}
      lectureCount={course.lectureCount || 0}
      duration={course.duration ? String(course.duration) : ""}
      isPublished={course.isPublished}
      isTrending={course.isTrending || false}
      tags={course.tags || []}
      price={course.price || 0}
      rating={course.rating || 0}
      reviewCount={course.reviewCount || 0}
    />
  )
}

export default CourseCard