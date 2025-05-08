"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, Flame, GraduationCap, Tag, ChevronDown } from "lucide-react"
import { OptimizedCourseCard } from "@/components/optimized-course-card"
import { useSearchParams } from "next/navigation"
import type { Course } from "@/types/course"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

const categories = [
  "All Categories",
  "Programming",
  "Design",
  "Business",
  "Marketing",
  "Photography",
  "Music",
  "Health & Fitness",
  "Personal Development",
]

const levels = ["All Levels", "Beginner", "Intermediate", "Advanced"]

export default function ExplorePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedLevel, setSelectedLevel] = useState("All Levels")
  const searchParams = useSearchParams()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (debouncedSearchQuery) params.append("search", debouncedSearchQuery)
        params.append("limit", "20")

        console.log("Fetching courses with params:", params.toString())
        const response = await fetch(`/api/courses?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`Failed to load courses: ${response.statusText}`)
        }

        const data = await response.json()
        console.log("Raw API response:", data)
        console.log("Received courses data:", {
          count: data.courses?.length,
          success: data.success,
          fromCache: data.fromCache,
          courses: data.courses?.map((c: any) => ({
            id: c.id,
            title: c.title,
            isPublished: c.isPublished,
            price: c.price,
          })),
        })
        setCourses(data.courses || [])
      } catch (err) {
        console.error("Error loading courses:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [searchParams, debouncedSearchQuery])

  // Filter courses based on category and level
  const filteredCourses = courses.filter((course) => {
    // If search query exists, filter by it
    const matchesSearch = debouncedSearchQuery
      ? course.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (course.description && course.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
        (course.creatorName && course.creatorName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
        (course.tags && course.tags.some((tag) => tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase())))
      : true

    const matchesCategory =
      selectedCategory === "All Categories" ||
      (course.tags && course.tags.some((tag) => tag.includes(selectedCategory)))

    const matchesLevel = selectedLevel === "All Levels" || course.level === selectedLevel

    return matchesSearch && matchesCategory && matchesLevel
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with gradient background */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background pt-12 pb-16 border-b">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Discover Your Next Learning Adventure</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore thousands of courses from expert instructors in various fields to expand your knowledge and
              skills.
            </p>

            <div className="relative max-w-2xl mx-auto mt-8">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <div className="relative">
                    <Input
                      type="search"
                      placeholder="Search courses, instructors, or topics..."
                      className="pl-10 h-12 rounded-l-full rounded-r-none border-r-0"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <div className="absolute w-full text-xs text-muted-foreground bg-background/95 backdrop-blur-sm py-1 px-3 rounded-md mt-1">
                        Searching in: course titles, descriptions, instructors, and tags
                      </div>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-12 rounded-none border-x-0 gap-2">
                      <Tag className="h-4 w-4" />
                      {selectedCategory}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Categories</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {categories.map((category) => (
                        <DropdownMenuItem
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={selectedCategory === category ? "bg-muted" : ""}
                        >
                          {category}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-12 rounded-l-none rounded-r-full border-l-0 gap-2">
                      <GraduationCap className="h-4 w-4" />
                      {selectedLevel}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Difficulty Level</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {levels.map((level) => (
                        <DropdownMenuItem
                          key={level}
                          onClick={() => setSelectedLevel(level)}
                          className={selectedLevel === level ? "bg-muted" : ""}
                        >
                          {level}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted transition-colors">
                  Web Development
                </Badge>
                <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted transition-colors">
                  Data Science
                </Badge>
                <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted transition-colors">
                  Mobile Development
                </Badge>
                <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted transition-colors">
                  Machine Learning
                </Badge>
                <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted transition-colors">
                  UI/UX Design
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Listings */}
      <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Browse Courses</h2>
              <p className="text-muted-foreground">
                {filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"} available
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Sort by: Popular
              </Button>
            </div>
          </div>

          <Tabs defaultValue="all" className="space-y-8">
            <TabsList className="bg-muted/50 p-1 inline-flex h-10 items-center justify-center rounded-md">
              <TabsTrigger value="all" className="rounded-sm data-[state=active]:bg-background">
                All Courses
              </TabsTrigger>
              <TabsTrigger value="trending" className="rounded-sm data-[state=active]:bg-background">
                <Flame className="h-4 w-4 mr-1" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-sm data-[state=active]:bg-background">
                New
              </TabsTrigger>
              <TabsTrigger value="free" className="rounded-sm data-[state=active]:bg-background">
                Free
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
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
                  ))
                ) : filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => (
                    <OptimizedCourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnail || ""}
                      authorName={course.creatorName || ""}
                      authorImage={course.creatorImage || ""}
                      authorId={course.creatorId || ""}
                      enrollmentCount={course.enrollmentCount || 0}
                      updatedAt={new Date(course.updatedAt)}
                      lectureCount={course.lectureCount || 0}
                      duration={course.totalDuration || ""}
                      isPublished={course.isPublished}
                      level={course.level || "Beginner"}
                      isTrending={course.isTrending || false}
                      tags={course.tags || []}
                      price={course.price || 0}
                      rating={course.rating || 0}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 bg-muted/30 rounded-lg col-span-full">
                    <h3 className="text-lg font-medium mb-2">No courses found</h3>
                    <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
                    <Button
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedCategory("All Categories")
                        setSelectedLevel("All Levels")
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="trending">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading &&
                  filteredCourses
                    .filter((course) => course.isTrending)
                    .map((course) => (
                      <OptimizedCourseCard
                        key={course.id}
                        id={course.id}
                        title={course.title}
                        description={course.description}
                        thumbnailUrl={course.thumbnail || ""}
                        authorName={course.creatorName || ""}
                        authorImage={course.creatorImage || ""}
                        authorId={course.creatorId || ""}
                        enrollmentCount={course.enrollmentCount || 0}
                        updatedAt={new Date(course.updatedAt)}
                        lectureCount={course.lectureCount || 0}
                        duration={course.totalDuration || ""}
                        isPublished={course.isPublished}
                        level={course.level || "Beginner"}
                        isTrending={course.isTrending || false}
                        tags={course.tags || []}
                        price={course.price || 0}
                        rating={course.rating || 0}
                      />
                    ))}
              </div>
            </TabsContent>

            <TabsContent value="new">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading &&
                  filteredCourses
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .map((course) => (
                      <OptimizedCourseCard
                        key={course.id}
                        id={course.id}
                        title={course.title}
                        description={course.description}
                        thumbnailUrl={course.thumbnail || ""}
                        authorName={course.creatorName || ""}
                        authorImage={course.creatorImage || ""}
                        authorId={course.creatorId || ""}
                        enrollmentCount={course.enrollmentCount || 0}
                        updatedAt={new Date(course.updatedAt)}
                        lectureCount={course.lectureCount || 0}
                        duration={course.totalDuration || ""}
                        isPublished={course.isPublished}
                        level={course.level || "Beginner"}
                        isTrending={course.isTrending || false}
                        tags={course.tags || []}
                        price={course.price || 0}
                        rating={course.rating || 0}
                      />
                    ))}
              </div>
            </TabsContent>

            <TabsContent value="free">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading &&
                  filteredCourses
                    .filter((course) => course.price === 0)
                    .map((course) => (
                      <OptimizedCourseCard
                        key={course.id}
                        id={course.id}
                        title={course.title}
                        description={course.description}
                        thumbnailUrl={course.thumbnail || ""}
                        authorName={course.creatorName || ""}
                        authorImage={course.creatorImage || ""}
                        authorId={course.creatorId || ""}
                        enrollmentCount={course.enrollmentCount || 0}
                        updatedAt={new Date(course.updatedAt)}
                        lectureCount={course.lectureCount || 0}
                        duration={course.totalDuration || ""}
                        isPublished={course.isPublished}
                        level={course.level || "Beginner"}
                        isTrending={course.isTrending || false}
                        tags={course.tags || []}
                        price={course.price || 0}
                        rating={course.rating || 0}
                      />
                    ))}
              </div>
            </TabsContent>
          </Tabs>

          {filteredCourses.length > 9 && (
            <div className="flex justify-center mt-8">
              <Button size="lg">Load More Courses</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
