"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OptimizedCourseCard } from "@/components/optimized-course-card"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserPlus, Bookmark } from "lucide-react"
import Link from "next/link"

interface BookmarkedCourse {
  id: string
  title: string
  description?: string
  thumbnailUrl: string
  authorName?: string
  authorImage?: string
  enrollmentCount: number
  updatedAt: string
  lectureCount: number
  duration?: string
  isPublished?: boolean
  isTrending?: boolean
  tags: string[]
  price?: number
  isEnrolled?: boolean
  rating?: number
  reviewCount?: number
  // Note: Keeping level in the interface for data consistency even though it's not used in OptimizedCourseCard
  level?: string
}

interface BookmarkedLecture {
  id: string
  lectureId: string
  lectureTitle: string
  lectureDescription?: string
  courseId: string
  courseTitle: string
  thumbnailUrl: string
  authorName?: string
  authorImage?: string
  duration?: number
  updatedAt: string
}

interface FollowedInstructor {
  id: string
  name: string
  image?: string
  bio?: string
  courseCount: number
  studentCount: number
}

export default function SavedCoursesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [courseBookmarks, setCourseBookmarks] = useState<BookmarkedCourse[]>([])
  const [lectureBookmarks, setLectureBookmarks] = useState<BookmarkedLecture[]>([])
  const [followedInstructors, setFollowedInstructors] = useState<FollowedInstructor[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        // Create a timestamp for cache-busting
        const cacheBustTimestamp = new Date().getTime().toString()
        const cacheBustHeaders = {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "X-Cache-Bust": cacheBustTimestamp
        }
        
        const [bookmarksResponse, instructorsResponse] = await Promise.all([
          fetch("/api/student/bookmarks", { 
            headers: cacheBustHeaders 
          }),
          fetch("/api/student/followed-instructors", {
            headers: cacheBustHeaders
          }),
        ])

        if (!bookmarksResponse.ok) {
          throw new Error("Failed to fetch bookmarks")
        }

        const bookmarksData = await bookmarksResponse.json()
        const instructorsData = await instructorsResponse.json()

        // Transform the course bookmarks data
        const transformedCourseBookmarks = bookmarksData.bookmarks.courses.map((bookmark: any) => ({
          ...bookmark,
          thumbnailUrl: bookmark.thumbnail || "",
          authorName: bookmark.creatorName,
          authorImage: bookmark.creatorImage,
        }))
        
        // Transform the lecture bookmarks data
        const transformedLectureBookmarks = bookmarksData.bookmarks.lectures.map((bookmark: any) => ({
          ...bookmark,
          thumbnailUrl: bookmark.thumbnail || "",
          authorName: bookmark.creatorName,
          authorImage: bookmark.creatorImage,
          updatedAt: bookmark.updatedAt || new Date().toISOString()
        }))

        setCourseBookmarks(transformedCourseBookmarks)
        setLectureBookmarks(transformedLectureBookmarks)
        setFollowedInstructors(instructorsData.instructors || [])
      } catch (error) {
        console.error("Error fetching data:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch data")
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session?.user])

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[400px] w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Saved Content
            </h1>
            <p className="text-lg text-muted-foreground">Manage your bookmarked courses and followed instructors.</p>
          </div>

          <Tabs defaultValue="courses" className="space-y-8">
            <TabsList className="w-full justify-start bg-background/50 backdrop-blur-sm border rounded-lg p-1">
              <TabsTrigger
                value="courses"
                className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 transition-all"
              >
                <Bookmark className="h-4 w-4" />
                Saved Courses
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {courseBookmarks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="lectures"
                className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 transition-all"
              >
                <Bookmark className="h-4 w-4" />
                Saved Lectures
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {lectureBookmarks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="instructors"
                className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 py-2 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                Followed Instructors
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {followedInstructors.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses" className="space-y-6">
              {courseBookmarks.length === 0 ? (
                <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bookmark className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>No Saved Courses Yet</CardTitle>
                    <CardDescription className="text-lg">
                      Start exploring courses and bookmark your favorites to find them here later.
                    </CardDescription>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/explore")}>
                      Explore Courses
                    </Button>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courseBookmarks.map((course) => (
                    <OptimizedCourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnailUrl}
                      authorName={course.authorName}
                      authorImage={course.authorImage}
                      enrollmentCount={course.enrollmentCount || undefined}
                      updatedAt={new Date(course.updatedAt)}
                      lectureCount={course.lectureCount}
                      duration={course.duration}
                      isPublished={course.isPublished}
                      isTrending={course.isTrending}
                      tags={course.tags}
                      price={course.price}
                      isEnrolled={course.isEnrolled}
                      rating={course.rating}
                      reviewCount={course.reviewCount}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lectures" className="space-y-6">
              {lectureBookmarks.length === 0 ? (
                <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bookmark className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>No Saved Lectures Yet</CardTitle>
                    <CardDescription className="text-lg">
                      Start watching lectures and bookmark your favorites to find them here later.
                    </CardDescription>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/explore")}>
                      Explore Courses
                    </Button>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {lectureBookmarks.map((lecture) => (
                    <Card key={lecture.id} className="overflow-hidden transform transition-all hover:scale-[1.01] hover:shadow-lg">
                      <div className="grid grid-cols-12 gap-0">
                        <div className="col-span-12 sm:col-span-3 relative">
                          <div className="aspect-video w-full h-full relative">
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-black/20 z-10" />
                            {lecture.thumbnailUrl ? (
                              <img
                                src={lecture.thumbnailUrl}
                                alt={lecture.lectureTitle}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <p className="text-muted-foreground">No thumbnail</p>
                              </div>
                            )}
                            {lecture.duration && (
                              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-20">
                                {Math.floor(lecture.duration / 60)}:{(lecture.duration % 60).toString().padStart(2, '0')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-12 sm:col-span-9 p-4 flex flex-col">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={lecture.authorImage || undefined} />
                                <AvatarFallback>{lecture.authorName?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-muted-foreground">{lecture.authorName || 'Unknown instructor'}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(lecture.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex-grow">
                            <h3 className="font-semibold text-lg line-clamp-2 mb-1">
                              {lecture.lectureTitle}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              From: <span className="font-medium">{lecture.courseTitle}</span>
                            </p>
                          </div>
                          <div className="flex justify-end mt-2">
                            <Button asChild>
                              <Link href={`/content/${lecture.courseId}/player/${lecture.id}`}>
                                Watch Lecture
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="instructors" className="space-y-6">
              {followedInstructors.length === 0 ? (
                <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>No Followed Instructors</CardTitle>
                    <CardDescription className="text-lg">
                      Follow your favorite instructors to stay updated with their latest courses.
                    </CardDescription>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/explore")}>
                      Find Instructors
                    </Button>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {followedInstructors.map((instructor) => (
                    <Card key={instructor.id} className="transform transition-all hover:scale-[1.02] hover:shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16 border-2 border-primary/20">
                            <AvatarImage src={instructor.image} alt={instructor.name} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {instructor.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg">{instructor.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {instructor.bio || "No bio available"}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Courses</p>
                            <p className="font-medium">{instructor.courseCount}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Students</p>
                            <p className="font-medium">{instructor.studentCount}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
