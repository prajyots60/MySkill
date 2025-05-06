"use client"

import type React from "react"

import { useEffect, useState, useMemo, memo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  AlertCircle,
  Youtube,
  CheckCircle2,
  BarChart3,
  Users,
  Video,
  Clock,
  TrendingUp,
  DollarSign,
  Eye,
  Star,
  Plus,
  Upload,
  ArrowRight,
  Calendar,
  MessageSquare,
  Settings,
  ExternalLink,
} from "lucide-react"
import { useCreatorCourses } from "@/lib/react-query/queries"
import { useYouTubeStore } from "@/lib/store/youtube-store"
import Link from "next/link"
import Image from "next/image"
import { UpcomingLectures } from "@/components/upcoming-lectures"

// Memoized components for better performance
const StatCard = memo(function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  loading,
  bgColor = "from-primary/10 to-background",
  iconColor = "text-primary",
}: {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
  trendValue?: string | number
  loading: boolean
  bgColor?: string
  iconColor?: string
}) {
  return (
    <Card className={`bg-gradient-to-br ${bgColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">
              {loading ? <div className="h-8 w-16 animate-pulse bg-muted rounded" /> : value}
            </div>
            {trend && trendValue && (
              <div
                className={`text-xs flex items-center mt-1 ${
                  trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {trend === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : null}
                {trendValue}
              </div>
            )}
          </div>
          <div className="p-2 bg-primary/10 rounded-full">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

const CourseCard = memo(function CourseCard({
  course,
  onView,
  onEdit,
}: {
  course: any
  onView: () => void
  onEdit: () => void
}) {
  return (
    <Card
      key={course.id}
      className="overflow-hidden flex flex-col group hover:shadow-md transition-shadow duration-200"
    >
      <div className="relative h-40 w-full">
        {course.thumbnail ? (
          <div className="relative h-full w-full">
            <Image
              src={course.thumbnail || "/placeholder.svg?height=160&width=320"}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <Video className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {!course.isPublished && (
          <div className="absolute top-2 right-2 bg-muted/90 text-muted-foreground px-2 py-1 rounded-md text-xs">
            Draft
          </div>
        )}
      </div>
      <CardHeader className="pb-2 flex-grow">
        <CardTitle className="line-clamp-1">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2">{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{course.enrollmentCount || 0} students enrolled</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <Clock className="h-4 w-4" />
          <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onView}>
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
})

// Recent activity component
const RecentActivity = memo(function RecentActivity() {
  // Mock activity data
  const activities = [
    {
      id: 1,
      type: "enrollment",
      content: "New student enrolled in Web Development Bootcamp",
      time: "2 hours ago",
    },
    {
      id: 2,
      type: "review",
      content: "New 5-star review on Advanced JavaScript",
      time: "5 hours ago",
    },
    {
      id: 3,
      type: "sale",
      content: "New sale: Data Science Fundamentals - $49.99",
      time: "Yesterday",
    },
    {
      id: 4,
      type: "comment",
      content: "New comment on lecture 'Introduction to React Hooks'",
      time: "Yesterday",
    },
    {
      id: 5,
      type: "enrollment",
      content: "New student enrolled in UI/UX Design Basics",
      time: "2 days ago",
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "enrollment":
        return <Users className="h-4 w-4 text-blue-500" />
      case "review":
        return <Star className="h-4 w-4 text-yellow-500" />
      case "sale":
        return <DollarSign className="h-4 w-4 text-green-500" />
      case "comment":
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates from your courses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-full">{getActivityIcon(activity.type)}</div>
              <div>
                <p className="text-sm">{activity.content}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/dashboard/creator/analytics">
            View All Activity
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
})

// Quick actions component
const QuickActions = memo(function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" asChild>
            <Link href="/dashboard/creator/content/create">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Create Course</span>
            </Link>
          </Button>

          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" asChild>
            <Link href="/dashboard/creator/content/upload">
              <Upload className="h-5 w-5" />
              <span className="text-xs">Upload Content</span>
            </Link>
          </Button>

          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" variant="outline" asChild>
            <Link href="/dashboard/creator/analytics">
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs">View Analytics</span>
            </Link>
          </Button>

          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" variant="outline" asChild>
            <Link href="/dashboard/creator/add-student">
              <Users className="h-5 w-5" />
              <span className="text-xs">Add Student</span>
            </Link>
          </Button>

          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" variant="outline" asChild>
            <Link href="/dashboard/creator/earnings">
              <DollarSign className="h-5 w-5" />
              <span className="text-xs">View Earnings</span>
            </Link>
          </Button>

          <Button className="h-auto py-4 flex flex-col items-center justify-center gap-2" variant="outline" asChild>
            <Link href="/dashboard/creator/settings">
              <Settings className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

export default function CreatorDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")

  // Use React Query for data fetching
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()

  // Use Zustand store for YouTube connection status
  const { connected: youtubeConnected, checkConnectionStatus } = useYouTubeStore()

  // Check YouTube connection on mount
  useEffect(() => {
    if (status === "authenticated") {
      checkConnectionStatus()
    }
  }, [status, checkConnectionStatus])

  // Memoize stats to prevent unnecessary re-renders
  const stats = useMemo(() => {
    if (!courses) {
      return {
        totalCourses: 0,
        totalStudents: 0,
        totalVideos: 0,
        totalViews: 0,
        totalRevenue: 0,
      }
    }

    return {
      totalCourses: courses.length,
      totalStudents: courses.reduce((acc: number, course: any) => acc + (course.enrollmentCount || 0), 0),
      totalVideos: courses.reduce((acc: number, course: any) => acc + (course.lectureCount || 0), 0),
      totalViews: courses.reduce((acc: number, course: any) => acc + (course.viewCount || 0), 0),
      totalRevenue: 8245.5, // Mock data for revenue
    }
  }, [courses])

  // Check for success message in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")

    if (success === "youtube_connected") {
      // Remove the query parameter
      router.replace("/dashboard/creator")
    }
  }, [router])

  if (status === "loading" || coursesLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
        Creator Dashboard
      </h1>

      {/* Public profile link */}
      <Alert className="mb-6 border-primary/20 bg-primary/5">
        <ExternalLink className="h-4 w-4 text-primary" />
        <AlertTitle className="font-medium">Your Public Creator Profile</AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span>View and share your public profile with students and followers.</span>
          <Button asChild variant="outline" size="sm" className="sm:ml-auto">
            <Link href={`/creators/${session?.user?.id}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Public Profile
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      {!youtubeConnected && (
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="font-medium">YouTube Connection Required</AlertTitle>
          <AlertDescription>
            To upload videos and create courses, you need to connect your YouTube account.
            <div className="mt-2">
              <Button asChild variant="default" size="sm">
                <Link href="/dashboard/creator/service-connections">
                  <Youtube className="mr-2 h-4 w-4" />
                  Connect YouTube
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Upcoming Lectures - Moved to top position for more visibility */}
          <Card className="bg-gradient-to-br from-primary/5 to-background border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg text-primary">
                <Calendar className="h-5 w-5 mr-2" />
                Your Upcoming Live Sessions
              </CardTitle>
              <CardDescription>
                Keep track of your scheduled live classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpcomingLectures 
                variant="creator" 
                showTitle={false} 
                className="border-none shadow-none bg-transparent" 
              />
            </CardContent>
          </Card>

          {/* Key metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Courses" value={stats.totalCourses} icon={Video} loading={coursesLoading} />
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              icon={Users}
              trend="up"
              trendValue="12% this month"
              loading={coursesLoading}
            />
            <StatCard
              title="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString()}`}
              icon={DollarSign}
              trend="up"
              trendValue="32% this month"
              loading={coursesLoading}
              bgColor="from-green-500/10 to-background"
              iconColor="text-green-500"
            />
            <StatCard
              title="Total Views"
              value={stats.totalViews || 12458}
              icon={Eye}
              trend="up"
              trendValue="8% this month"
              loading={coursesLoading}
              bgColor="from-blue-500/10 to-background"
              iconColor="text-blue-500"
            />
          </div>

          {/* Dashboard content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Courses</CardTitle>
                  <CardDescription>Your most recent courses</CardDescription>
                </CardHeader>
                <CardContent>
                  {!courses || courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Video className="h-10 w-10 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No courses yet</h3>
                      <p className="text-muted-foreground mb-4">Create your first course to start teaching</p>
                      <Button asChild>
                        <Link href="/dashboard/creator/content/create">Create Course</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courses.slice(0, 4).map((course: any) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onView={() => router.push(`/content/${course.id}`)}
                          onEdit={() => router.push(`/dashboard/creator/content/${course.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/creator/content/create">
                      Create New Course
                      <Plus className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                  <CardDescription>Key metrics for the last 30 days</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Analytics Preview</h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      View detailed analytics about your courses, students, revenue, and more
                    </p>
                    <Button asChild>
                      <Link href="/dashboard/creator/analytics">
                        View Full Analytics
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <QuickActions />
              <RecentActivity />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold">Your Courses</h2>
            <Button asChild>
              <Link href="/dashboard/creator/content/create">Create New Course</Link>
            </Button>
          </div>

          {!courses || courses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">No courses yet</h3>
                <p className="text-muted-foreground mb-4">Create your first course to start teaching</p>
                <Button asChild>
                  <Link href="/dashboard/creator/content/create">Create Course</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course: any) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onView={() => router.push(`/content/${course.id}`)}
                  onEdit={() => router.push(`/dashboard/creator/content/${course.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>View detailed analytics about your courses</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Analytics Dashboard</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Get detailed insights about your courses, students, revenue, and more
                </p>
                <Button asChild>
                  <Link href="/dashboard/creator/analytics">
                    Go to Analytics Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {youtubeConnected && (
        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-4 bg-success/10 rounded-md border border-success/20">
          <CheckCircle2 className="h-5 w-5 text-success mt-0.5 sm:mt-0" />
          <p className="text-sm">Your YouTube account is connected and ready to use for video uploads.</p>
          <Button variant="link" size="sm" asChild className="ml-0 sm:ml-auto p-0 sm:p-2">
            <Link href="/dashboard/creator/service-connections">Manage Connection</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
