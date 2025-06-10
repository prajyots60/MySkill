"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, CheckCircle, Search, ArrowUpDown, Layers } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Course, UserProgress } from "@/lib/types"
import { OptimizedCourseCard } from "@/components/optimized-course-card"

interface EnrolledCourse extends Course {
  completedAt?: string | null
  certificateId?: string | null
  totalLectures: number
  completedLectures: number
  progress: number
  nextLecture?: {
    id: string
    title: string
  } | null
  lastAccessed?: Date | null
  totalDuration?: string
  enrollmentCount: number
}

interface SavedCreator {
  id: string
  name: string
  image: string
  bio: string
  followers: number
  coursesCount: number
  rating: number
  tags: string[]
}

export default function MyCoursesPage() {
  const { data: session, status } = useSession()
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([])
  const [inProgressCourses, setInProgressCourses] = useState<EnrolledCourse[]>([])
  const [completedCourses, setCompletedCourses] = useState<EnrolledCourse[]>([])
  const [savedCourses, setSavedCourses] = useState<Course[]>([])
  const [savedCreators, setSavedCreators] = useState<SavedCreator[]>([])
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortOption, setSortOption] = useState<"recent" | "name">("recent")

  const trackNavigation = (url: string) => {
    console.log(`Navigating to: ${url}`)
  }

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      try {
        setLoading(true)

        // Create a timestamp for cache-busting
        const cacheBustTimestamp = new Date().getTime().toString()
        
        // Fetch enrolled courses with proper error handling and cache-busting
        const response = await fetch("/api/student/enrollments", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Cache-Bust": cacheBustTimestamp
          },
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch enrolled courses")
        }

        if (!data.success) {
          throw new Error(data.message || "Failed to fetch enrolled courses")
        }

        // Update state with the fetched data
        setInProgressCourses(data.inProgressCourses || [])
        setCompletedCourses(data.completedCourses || [])
        setEnrolledCourses([...(data.inProgressCourses || []), ...(data.completedCourses || [])])

        // No need to set mock data anymore since we're using real data
      } catch (error) {
        console.error("Error fetching enrolled courses:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load your courses. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchEnrolledCourses()
    }
  }, [session])

  const sortCourses = (courses: EnrolledCourse[]) => {
    switch (sortOption) {
      case "name":
        return [...courses].sort((a, b) => a.title.localeCompare(b.title))
      case "recent":
      default:
        return [...courses].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    }
  }

  const filteredInProgressCourses = sortCourses(
    searchQuery
      ? inProgressCourses.filter(
          (course) =>
            course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.creatorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
        )
      : inProgressCourses,
  )

  const filteredCompletedCourses = sortCourses(
    searchQuery
      ? completedCourses.filter(
          (course) =>
            course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.creatorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
        )
      : completedCourses,
  )

  const filteredSavedCourses = searchQuery
    ? savedCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.creatorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : savedCourses

  const removeSavedCourse = (courseId: string) => {
    setSavedCourses(savedCourses.filter((course) => course.id !== courseId))
    toast({
      title: "Course removed",
      description: "The course has been removed from your saved items",
    })
  }

  const removeSavedCreator = (creatorId: string) => {
    setSavedCreators(savedCreators.filter((creator) => creator.id !== creatorId))
    toast({
      title: "Creator removed",
      description: "The creator has been removed from your saved list",
    })
  }

  // Add a function to handle unenrolling from a course
  const handleUnenroll = async (courseId: string) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/enrollment`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to unenroll from course")
      }

      toast({
        title: "Success",
        description: "Successfully unenrolled from course",
      })

      // Refresh the course list
      setEnrolledCourses(enrolledCourses.filter((course) => course.id !== courseId))
      setInProgressCourses(inProgressCourses.filter((course) => course.id !== courseId))
      setCompletedCourses(completedCourses.filter((course) => course.id !== courseId))
    } catch (error) {
      console.error("Error unenrolling from course:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unenroll from course",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="bg-background min-h-screen pb-12">
      {/* Page header with gradient */}
      <div className="relative bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-background pt-10 pb-16 border-b overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Courses</h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Manage your enrolled courses, track your progress, and continue your learning journey.
              </p>
            </div>
            <Button asChild variant="default" size="lg" className="gap-2 shadow-md">
              <Link href="/explore" onClick={() => trackNavigation("/explore")}>
                <Search className="h-4 w-4" />
                Discover More
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Filters and controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your courses..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span>Sort: {sortOption === "recent" ? "Recent" : "Name"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortOption("recent")}>
                  <Clock className="h-4 w-4 mr-2" />
                  Recently Accessed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption("name")}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Course Name
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Course Tabs */}
        <Tabs defaultValue="in-progress" className="space-y-8">
          <TabsList className="bg-muted/50 p-1 inline-flex h-10 items-center justify-center rounded-md">
            <TabsTrigger value="in-progress" className="rounded-sm data-[state=active]:bg-background">
              <Layers className="h-4 w-4 mr-2" />
              In Progress
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-sm data-[state=active]:bg-background">
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in-progress" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-48 bg-muted" />
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredInProgressCourses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No courses in progress</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInProgressCourses.map((course) => (
                  <OptimizedCourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description || ""}
                    thumbnailUrl={course.thumbnail || ""}
                    authorName={course.creatorName || ""}
                    authorImage={course.creatorImage || ""}
                    enrollmentCount={course.enrollmentCount !== null ? course.enrollmentCount : undefined}
                    updatedAt={new Date(course.updatedAt || Date.now())}
                    lectureCount={course.totalLectures}
                    duration={course.totalDuration || ""}
                    tags={course.tags || []}
                    price={course.price ?? undefined}
                    isEnrolled={true}
                    rating={course.rating}
                    reviewCount={course.reviewCount}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-48 bg-muted" />
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCompletedCourses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No completed courses</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompletedCourses.map((course) => (
                  <OptimizedCourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description || ""}
                    thumbnailUrl={course.thumbnail || ""}
                    authorName={course.creatorName || ""}
                    authorImage={course.creatorImage || ""}
                    enrollmentCount={course.enrollmentCount !== null ? course.enrollmentCount : undefined}
                    updatedAt={new Date(course.updatedAt || Date.now())}
                    lectureCount={course.totalLectures}
                    duration={course.totalDuration || ""}
                    tags={course.tags || []}
                    price={course.price ?? undefined}
                    isEnrolled={true}
                    rating={course.rating}
                    reviewCount={course.reviewCount}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
