export interface Course {
  id: string
  title: string
  description: string
  thumbnail: string | null
  price: number | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
  level: string | null
  enrollmentCount: number
  lectureCount: number
  creatorName: string | null
  creatorImage: string | null
  creatorId: string | null
  isTrending?: boolean
  totalDuration?: string
}

export interface CourseResponse {
  success: boolean
  courses: Course[]
  totalCount: number
  fromCache: boolean
  message?: string
}
