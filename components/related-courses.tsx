"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface RelatedCoursesProps {
  courseId: string
}

interface RelatedCourse {
  id: string
  title: string
  description: string
  thumbnail: string | null
  price: number | null
  type: string
  tags: string[]
  _count: {
    enrollments: number
  }
  creator: {
    name: string | null
    image: string | null
  }
  rating?: number
  reviewCount?: number
}

export default function RelatedCourses({ courseId }: RelatedCoursesProps) {
  const [courses, setCourses] = useState<RelatedCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRelatedCourses() {
      try {
        const response = await fetch(`/api/courses/${courseId}/related`)
        const data = await response.json()
        if (response.ok) {
          setCourses(data.courses)
        }
      } catch (error) {
        console.error("Error fetching related courses:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRelatedCourses()
  }, [courseId])

  if (loading) {
    return (
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg">Related Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-muted/30">
        <CardTitle className="text-lg">Related Courses</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {courses.map((course) => (
            <Link key={course.id} href={`/content/${course.id}`}>
              <div className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-md overflow-hidden shrink-0">
                    <Image
                      src={course.thumbnail || "/placeholder.svg"}
                      alt={course.title}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div className="min-h-[64px]">
                    <h4 className="font-medium line-clamp-1">{course.title}</h4>
                    <p className="text-sm text-muted-foreground">{course.creator.name || "Anonymous Instructor"}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      <span className="text-xs">{course.rating?.toFixed(1) || "0.0"}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {course.price ? `$${course.price.toFixed(2)}` : "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
