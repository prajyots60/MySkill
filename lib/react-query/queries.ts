import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Course, Lecture } from "@/lib/types"

// Query keys
export const QUERY_KEYS = {
  COURSES: "courses",
  COURSE: (id: string) => ["course", id],
  CREATOR_COURSES: "creator-courses",
  CREATOR_PROFILE: (id: string) => ["creator-profile", id],
  CREATOR_PUBLIC_COURSES: (id: string) => ["creator-public-courses", id],
  SECTIONS: (courseId: string) => ["sections", courseId],
  LECTURES: (sectionId: string) => ["lectures", sectionId],
  LECTURE: (id: string) => ["lecture", id],
  YOUTUBE_CONNECTION: "youtube-connection",
  GDRIVE_CONNECTION: "gdrive-connection",
  USER_PROGRESS: (courseId: string) => ["progress", courseId],
  ENROLLED_STUDENTS: "enrolled-students",
  STUDENT_DETAILS: (studentId: string) => ["student-details", studentId],
  STUDENT_COURSE_PROGRESS: (studentId: string, courseId: string) => ["student-course-progress", studentId, courseId],
}

// Course queries
export function useCreatorCourses() {
  return useQuery({
    queryKey: [QUERY_KEYS.CREATOR_COURSES],
    queryFn: async () => {
      const response = await fetch("/api/creator/courses")
      if (!response.ok) {
        throw new Error("Failed to fetch courses")
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch courses")
      }
      return data.courses
    },
  })
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.COURSE(courseId),
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch course")
      }
      const data = await response.json()
      return data.course
    },
    enabled: !!courseId,
  })
}

export function useCourseSections(courseId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.SECTIONS(courseId),
    queryFn: async () => {
      const response = await fetch(`/api/creator/courses/${courseId}/sections`)
      if (!response.ok) {
        throw new Error("Failed to fetch sections")
      }
      const data = await response.json()
      return data.sections
    },
    enabled: !!courseId,
  })
}

// Lecture queries
export function useLecture(lectureId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.LECTURE(lectureId),
    queryFn: async () => {
      const response = await fetch(`/api/creator/lectures/${lectureId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch lecture")
      }
      const data = await response.json()
      return data.lecture
    },
    enabled: !!lectureId,
  })
}

// YouTube connection query
export function useYouTubeConnection() {
  return useQuery({
    queryKey: [QUERY_KEYS.YOUTUBE_CONNECTION],
    queryFn: async () => {
      const response = await fetch("/api/youtube/status")
      if (!response.ok) {
        throw new Error("Failed to fetch YouTube connection status")
      }
      const data = await response.json()
      return data
    },
  })
}

// Google Drive connection query
export function useGDriveConnection() {
  return useQuery({
    queryKey: [QUERY_KEYS.GDRIVE_CONNECTION],
    queryFn: async () => {
      const response = await fetch("/api/gdrive/status")
      if (!response.ok) {
        throw new Error("Failed to fetch Google Drive connection status")
      }
      const data = await response.json()
      return data
    },
  })
}

// Creator profile queries
export function useCreatorProfile(creatorId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CREATOR_PROFILE(creatorId),
    queryFn: async () => {
      const response = await fetch(`/api/creators/${creatorId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch creator profile")
      }
      const data = await response.json()
      return data.creator
    },
    enabled: !!creatorId,
  })
}

export function useCreatorPublicCourses(creatorId: string, page = 1, limit = 12, tag?: string, options = {}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CREATOR_PUBLIC_COURSES(creatorId), page, limit, tag],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("limit", limit.toString())
      if (tag) params.append("tag", tag)
      
      const response = await fetch(`/api/creators/${creatorId}/courses?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch creator courses")
      }
      const data = await response.json()
      return {
        courses: data.courses,
        pagination: data.pagination,
      }
    },
    enabled: !!creatorId,
    ...options
  })
}

// Student Management Queries
export function useCreatorEnrolledStudents() {
  return useQuery({
    queryKey: [QUERY_KEYS.ENROLLED_STUDENTS],
    queryFn: async () => {
      const response = await fetch("/api/creator/students")
      if (!response.ok) {
        throw new Error("Failed to fetch enrolled students")
      }
      const data = await response.json()
      return data.students
    },
  })
}

export function useStudentDetails(studentId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.STUDENT_DETAILS(studentId),
    queryFn: async () => {
      const response = await fetch(`/api/creator/students/${studentId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch student details")
      }
      const data = await response.json()
      return data.student
    },
    enabled: !!studentId,
  })
}

export function useStudentCourseProgress(studentId: string, courseId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.STUDENT_COURSE_PROGRESS(studentId, courseId),
    queryFn: async () => {
      const response = await fetch(`/api/creator/students/${studentId}/progress?courseId=${courseId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch student course progress")
      }
      const data = await response.json()
      return data.progress
    },
    enabled: !!studentId && !!courseId,
  })
}

// Mutations
export function useUpdateCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (courseData: Partial<Course> & { id: string }) => {
      const { id, ...data } = courseData
      const response = await fetch(`/api/creator/courses/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to update course")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.id) })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CREATOR_COURSES] })
    },
  })
}

export function useAddSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ courseId, title, description }: { courseId: string; title: string; description?: string }) => {
      const response = await fetch(`/api/creator/courses/${courseId}/sections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      })

      if (!response.ok) {
        throw new Error("Failed to add section")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SECTIONS(variables.courseId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.courseId) })
    },
  })
}

export function useDeleteSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sectionId, courseId }: { sectionId: string; courseId: string }) => {
      const response = await fetch(`/api/creator/sections/${sectionId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete section")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SECTIONS(variables.courseId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.courseId) })
    },
  })
}

export function useAddLecture() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sectionId,
      title,
      description,
      isPreview,
      courseId,
    }: {
      sectionId: string
      title: string
      description?: string
      isPreview?: boolean
      courseId: string
    }) => {
      const response = await fetch(`/api/creator/sections/${sectionId}/lectures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, isPreview, type: "VIDEO" }),
      })

      if (!response.ok) {
        throw new Error("Failed to add lecture")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SECTIONS(variables.courseId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.courseId) })
    },
  })
}

export function useDeleteLecture() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ lectureId, courseId }: { lectureId: string; courseId: string }) => {
      const response = await fetch(`/api/creator/lectures/${lectureId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete lecture")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.courseId) })
    },
  })
}

export function useUpdateLecture() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      lectureId,
      data,
      courseId,
    }: {
      lectureId: string
      data: Partial<Lecture>
      courseId: string
    }) => {
      const response = await fetch(`/api/creator/lectures/${lectureId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to update lecture")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LECTURE(variables.lectureId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COURSE(variables.courseId) })
    },
  })
}

// User progress
export function useUserProgress(courseId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.USER_PROGRESS(courseId),
    queryFn: async () => {
      const response = await fetch(`/api/progress?courseId=${courseId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch user progress")
      }
      const data = await response.json()
      return data.progress
    },
    enabled: !!courseId,
  })
}

// Enrollment queries and mutations
export function useEnrollmentStatus(courseId: string) {
  return useQuery({
    queryKey: ["enrollment", courseId],
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}/enrollment`)
      if (!response.ok) {
        throw new Error("Failed to fetch enrollment status")
      }
      const data = await response.json()
      return data
    },
    enabled: !!courseId,
  })
}

export function useEnrollInCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/courses/${courseId}/enrollment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to enroll in course")
      }

      return response.json()
    },
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", courseId] })
      queryClient.invalidateQueries({ queryKey: ["student", "enrollments"] })
    },
  })
}

export function useUnenrollFromCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/courses/${courseId}/enrollment`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to unenroll from course")
      }

      return response.json()
    },
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", courseId] })
      queryClient.invalidateQueries({ queryKey: ["student", "enrollments"] })
    },
  })
}

// Progress queries and mutations
export function useCourseProgress(courseId: string) {
  return useQuery({
    queryKey: ["progress", "course", courseId],
    queryFn: async () => {
      const response = await fetch(`/api/progress?courseId=${courseId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch course progress")
      }
      const data = await response.json()
      return data.progress
    },
    enabled: !!courseId,
  })
}

export function useLectureProgress(lectureId: string) {
  return useQuery({
    queryKey: ["progress", "lecture", lectureId],
    queryFn: async () => {
      const response = await fetch(`/api/progress?lectureId=${lectureId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch lecture progress")
      }
      const data = await response.json()
      return data.progress
    },
    enabled: !!lectureId,
  })
}

export function useUpdateProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      lectureId,
      percentage,
      isComplete,
      timeSpentSeconds,
      courseId,
    }: {
      lectureId: string
      percentage?: number
      isComplete?: boolean
      timeSpentSeconds?: number
      courseId: string
    }) => {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lectureId,
          percentage,
          isComplete,
          timeSpentSeconds,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to update progress")
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["progress", "lecture", variables.lectureId] })
      queryClient.invalidateQueries({ queryKey: ["progress", "course", variables.courseId] })
      queryClient.invalidateQueries({ queryKey: ["student", "enrollments"] })
    },
  })
}
