"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Play, BookOpen, Search, ChevronRight, Compass, BarChart } from "lucide-react"
import Link from "next/link"
import { StudentNotifications } from "@/components/student-notifications"
import { UpcomingLectures } from "@/components/upcoming-lectures"
import { RecommendedCreators } from "@/components/recommended-creators"
import type { Course } from "@/lib/types"
import { toast } from "@/components/ui/use-toast"

interface EnrolledCourse extends Course {
  completedLectures: number
  totalLectures: number
  progress: number
  nextLecture?: {
    id: string
    title: string
  } | null
}

export default function StudentDashboard() {
  const { data: session, status } = useSession()
  const [inProgressCourses, setInProgressCourses] = useState<EnrolledCourse[]>([])
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCoursesEnrolled: 0,
    totalHoursLearned: 0,
    completionRate: 0,
  })
  const [searchQuery, setSearchQuery] = useState("")

  // Dummy function for trackNavigation (replace with your actual implementation)
  const trackNavigation = (path: string) => {
    console.log(`Navigated to: ${path}`)
    // Add your analytics tracking logic here
  }

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      try {
        setLoading(true)

        // Fetch enrolled courses with proper error handling
        const response = await fetch("/api/student/enrollments", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
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
        setStats((prevStats) => ({
          ...prevStats,
          ...data.stats,
        }))

        // Get a list of enrolled course IDs to filter out from recommendations
        const enrolledCourseIds = data.inProgressCourses?.map((course: any) => course.id) || [];

        // Fetch recommended courses
        const recommendedResponse = await fetch("/api/courses?limit=10", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })

        const recommendedData = await recommendedResponse.json()
        if (recommendedResponse.ok && recommendedData.success) {
          // Filter out already enrolled courses and limit to max 2 courses
          const filteredRecommendations = recommendedData.courses
            .filter((course: any) => !enrolledCourseIds.includes(course.id))
            .slice(0, 2); // Show at most 2 recommendations
            
          setRecommendedCourses(filteredRecommendations);
        }
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

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <Skeleton className="h-12 w-1/3 mb-6" />
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p className="mb-6">Please sign in to access your dashboard.</p>
        <Button asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
      </div>
    )
  }

  const filteredInProgressCourses = searchQuery
    ? inProgressCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.creatorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : inProgressCourses

  return (
    <div className="bg-background min-h-screen pb-12">
      {/* Modern hero section with gradient and pattern */}
      <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-background pt-10 pb-16 border-b overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your Learning Dashboard</h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Track your progress, continue learning, and discover new courses tailored for you.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="default" size="lg" className="gap-2 shadow-md">
                <Link href="/explore" onClick={() => trackNavigation("/explore")}>
                  <Compass className="h-4 w-4" />
                  Discover Courses
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 -mt-8">
        {/* Quick Stats Cards - Modern, colorful design */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-background">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-blue-500" />
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  Courses
                </Badge>
              </div>
              <div>
                <h3 className="text-3xl font-bold">{stats.totalCoursesEnrolled}</h3>
                <p className="text-sm text-muted-foreground mt-1">Enrolled Courses</p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-background">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  Hours
                </Badge>
              </div>
              <div>
                <h3 className="text-3xl font-bold">{stats.totalHoursLearned}</h3>
                <p className="text-sm text-muted-foreground mt-1">Learning Hours</p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-500/10 via-green-400/5 to-background">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <BarChart className="h-6 w-6 text-green-500" />
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  Progress
                </Badge>
              </div>
              <div>
                <h3 className="text-3xl font-bold">{stats.completionRate}%</h3>
                <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {inProgressCourses.length === 0 && (
          <div className="text-center mb-8">
            <Button asChild size="lg" className="gap-2">
              <Link href="/explore">
                <Search className="h-4 w-4" />
                Explore New Courses
              </Link>
            </Button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Continue Learning Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Continue Learning</h2>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <Link href="/dashboard/student/my-courses">
                    View all courses <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-6">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden border-none shadow-md">
                      <div className="flex flex-col md:flex-row">
                        <Skeleton className="h-40 w-full md:w-64 md:min-w-64" />
                        <div className="p-6 flex-1">
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-full mb-4" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-2/3 mb-4" />
                          <Skeleton className="h-10 w-40" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : filteredInProgressCourses.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {filteredInProgressCourses.slice(0, 3).map((course) => (
                    <Card
                      key={course.id}
                      className="overflow-hidden flex flex-col md:flex-row group hover:shadow-lg transition-all duration-200 border-none shadow-md"
                    >
                      <div className="relative h-40 md:w-64 md:min-w-64 overflow-hidden cursor-pointer">
                        <Link href={`/content/${course.id}`}>
                          <img
                            src={course.thumbnail || "/placeholder.svg"}
                            alt={course.title}
                            className="object-cover w-full h-full transition-transform group-hover:scale-105 duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm text-white border-none">
                              {course.progress || 0}% Complete
                            </Badge>
                          </div>
                        </Link>
                      </div>
                      <div className="flex-1 p-6">
                        <div className="flex justify-between items-start mb-2">
                          <Link href={`/content/${course.id}`}>
                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors cursor-pointer">
                              {course.title}
                            </h3>
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={course.creatorImage || "/placeholder.svg"} alt={course.creatorName} />
                            <AvatarFallback>{course.creatorName?.charAt(0) || "C"}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">{course.creatorName}</span>
                        </div>

                        {/* Simple visual progress bar replacement */}
                        <div className="h-2 mb-3 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${course.progress || 0}%` }}
                          ></div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>
                              {course.completedLectures || 0}/{course.totalLectures || 0} lectures
                            </span>
                          </div>
                        </div>

                        <Button
                          asChild
                          className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
                        >
                          <Link
                            href={
                              course.nextLecture
                                ? `/content/${course.id}/player/${course.nextLecture.id}`
                                : `/content/${course.id}`
                            }
                          >
                            <Play className="h-4 w-4" />
                            {course.nextLecture ? "Continue Learning" : "Start Course"}
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-lg border border-border/40">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">You haven&apos;t started any courses yet</h3>
                  <p className="text-muted-foreground mb-6">Explore our catalog and find courses that interest you</p>
                  <Button asChild size="lg" className="gap-2">
                    <Link href="/explore">
                      <Search className="h-4 w-4" />
                      Browse Courses
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Recommended For You Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Recommended For You</h2>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <Link href="/explore">
                    View all <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden border-none shadow-md">
                      <Skeleton className="h-48 w-full" />
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                      <CardFooter>
                        <Skeleton className="h-10 w-full" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : recommendedCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendedCourses.map((course) => (
                    <Card
                      key={course.id}
                      className="overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-200 border-none shadow-md"
                    >
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={course.thumbnail || "/placeholder.svg"}
                          alt={course.title}
                          className="object-cover w-full h-full transition-transform group-hover:scale-105 duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={course.creatorImage || "/placeholder.svg"} alt={course.creatorName} />
                            <AvatarFallback>{course.creatorName?.charAt(0) || "C"}</AvatarFallback>
                          </Avatar>
                          <span>{course.creatorName}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow pb-2">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{course.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {course.tags?.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-2 flex justify-between items-center border-t">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <BookOpen className="h-4 w-4 mr-1" />
                            <span>{course.lectureCount || 0} lectures</span>
                          </div>
                        </div>
                        <Button asChild variant="outline" className="group-hover:bg-primary group-hover:text-white">
                          <Link href={`/content/${course.id}`}>View</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-lg border border-border/40">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Complete more courses to get personalized recommendations
                  </p>
                  <Button asChild size="lg" className="gap-2">
                    <Link href="/explore">
                      <Search className="h-4 w-4" />
                      Browse Courses
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Lectures */}
            <UpcomingLectures showTitle={true} />

            {/* Notifications */}
            <StudentNotifications />

            {/* Recommended Instructors (renamed from Creators) */}
            <RecommendedCreators />
          </div>
        </div>
      </div>
    </div>
  )
}
