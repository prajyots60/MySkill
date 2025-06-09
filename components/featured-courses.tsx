"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Star, TrendingUp, BookOpen } from "lucide-react"
import Link from "next/link"
import type { Course } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export function FeaturedCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        setLoading(true)
        // Fetch courses from API
        const response = await fetch("/api/content/featured-courses", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch featured courses")
        }

        const data = await response.json()
        
        if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses)
        } else {
          // If the API returns no courses or invalid data structure, use fallback
          setFallbackCourses()
        }
      } catch (error) {
        console.error("Error fetching featured courses:", error)
        // Set fallback courses when fetch fails
        setFallbackCourses()
        toast({
          title: "Couldn't load featured courses",
          description: "Using cached data instead.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchFeaturedCourses()
  }, [toast])

  // Fallback to placeholder courses if API fails
  const setFallbackCourses = () => {
    setCourses([
      {
        id: "1",
        title: "Web Development Fundamentals",
        description: "Learn the basics of HTML, CSS, and JavaScript to build your first website.",
        thumbnail: "/placeholder.svg?height=200&width=400",
        creatorName: "John Doe",
        creatorImage: "/placeholder.svg?height=40&width=40",
        enrollmentCount: 1245,
        tags: ["Web Development", "HTML", "CSS", "JavaScript"],
        isPublished: true,
        updatedAt: new Date(),
        creatorId: "creator-1",
        price: null,
        level: "Beginner",
        lectureCount: 12,
        rating: 4.7,
        reviewCount: 153,
        isTrending: true
      },
      {
        id: "2",
        title: "Data Science for Beginners",
        description: "Introduction to data analysis, visualization, and machine learning concepts.",
        thumbnail: "/placeholder.svg?height=200&width=400",
        creatorName: "Jane Smith",
        creatorImage: "/placeholder.svg?height=40&width=40",
        enrollmentCount: 987,
        tags: ["Data Science", "Python", "Machine Learning"],
        isPublished: true,
        updatedAt: new Date(),
        creatorId: "creator-2",
        price: null,
        level: "Beginner",
        lectureCount: 10,
        rating: 4.5,
        reviewCount: 98,
        isTrending: false
      },
      {
        id: "3",
        title: "Mobile App Development",
        description: "Build cross-platform mobile applications using React Native.",
        thumbnail: "/placeholder.svg?height=200&width=400",
        creatorName: "Alex Johnson",
        creatorImage: "/placeholder.svg?height=40&width=40",
        enrollmentCount: 756,
        tags: ["Mobile Development", "React Native", "JavaScript"],
        isPublished: true,
        updatedAt: new Date(),
        creatorId: "creator-3",
        price: null,
        level: "Intermediate",
        lectureCount: 15,
        rating: 4.8,
        reviewCount: 126,
        isTrending: true
      },
    ])
  }

  return (
    <section className="py-16 px-4 md:px-6">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold">Featured Courses</h2>
          <Button asChild variant="outline">
            <Link href="/explore">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardHeader>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))
            : courses.map((course) => (
                <Card key={course.id} className="overflow-hidden flex flex-col">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={course.thumbnail || "/placeholder.svg"}
                      alt={course.title}
                      className="object-cover w-full h-full transition-transform hover:scale-105 duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      {course.price === 0 && <span className="px-2 py-1 bg-green-500/90 text-white text-xs rounded-full">Free</span>}
                      {course.isTrending && (
                        <span className="px-2 py-1 bg-amber-500/90 text-white text-xs rounded-full flex items-center">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Trending
                        </span>
                      )}
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{course.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-6 w-6 rounded-full overflow-hidden">
                        <img
                          src={course.creatorImage || "/placeholder.svg"}
                          alt={course.creatorName || "Creator"}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{course.creatorName}</span>
                    </div>
                    <div className="flex items-center mt-2">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium">
                          {course.rating?.toFixed(1) || "0.0"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({course.reviewCount || 0})
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{course.description}</p>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        <span>{course.lectureCount || 0} lectures</span>
                      </div>
                      {course.level && (
                        <div className="flex items-center">
                          <span>{course.level}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {course.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href={`/content/${course.id}`}>View Course</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
        </div>
      </div>
    </section>
  )
}
