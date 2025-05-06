"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, TrendingUp, Users, Eye, Clock, Download } from "lucide-react"
import { useCreatorCourses } from "@/lib/react-query/queries"
import { BarChart, LineChart, PieChart } from "./charts"

export default function AnalyticsDashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [timeRange, setTimeRange] = useState("30days")
  const [selectedCourse, setSelectedCourse] = useState("all")

  // Fetch courses data
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()

  // Mock analytics data - in a real app, this would come from your API
  const analyticsData = {
    totalViews: 12458,
    totalStudents: 843,
    totalRevenue: 8245.5,
    completionRate: 68,
    averageRating: 4.7,
    viewsGrowth: 24,
    studentsGrowth: 18,
    revenueGrowth: 32,

    // Time series data for charts
    viewsOverTime: [
      { date: "Jan", value: 1200 },
      { date: "Feb", value: 1900 },
      { date: "Mar", value: 2400 },
      { date: "Apr", value: 1800 },
      { date: "May", value: 2800 },
      { date: "Jun", value: 3200 },
      { date: "Jul", value: 3800 },
    ],

    revenueOverTime: [
      { date: "Jan", value: 800 },
      { date: "Feb", value: 1200 },
      { date: "Mar", value: 1800 },
      { date: "Apr", value: 1400 },
      { date: "May", value: 2200 },
      { date: "Jun", value: 2600 },
      { date: "Jul", value: 3200 },
    ],

    studentsOverTime: [
      { date: "Jan", value: 120 },
      { date: "Feb", value: 240 },
      { date: "Mar", value: 380 },
      { date: "Apr", value: 460 },
      { date: "May", value: 580 },
      { date: "Jun", value: 680 },
      { date: "Jul", value: 840 },
    ],

    coursePerformance: [
      { name: "Web Development", students: 320, revenue: 3200 },
      { name: "Data Science", students: 180, revenue: 1800 },
      { name: "Mobile App Dev", students: 140, revenue: 1400 },
      { name: "UI/UX Design", students: 120, revenue: 1200 },
      { name: "Digital Marketing", students: 80, revenue: 800 },
    ],

    studentDemographics: [
      { name: "North America", value: 40 },
      { name: "Europe", value: 30 },
      { name: "Asia", value: 20 },
      { name: "Other", value: 10 },
    ],

    deviceUsage: [
      { name: "Desktop", value: 55 },
      { name: "Mobile", value: 35 },
      { name: "Tablet", value: 10 },
    ],
  }

  if (status === "loading" || coursesLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading analytics data...</p>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your performance and growth</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses?.map((course: any) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${analyticsData.totalRevenue.toLocaleString()}</div>
                <div className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {analyticsData.revenueGrowth}% from last period
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{analyticsData.totalStudents.toLocaleString()}</div>
                <div className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {analyticsData.studentsGrowth}% from last period
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{analyticsData.totalViews.toLocaleString()}</div>
                <div className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {analyticsData.viewsGrowth}% from last period
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Eye className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{analyticsData.completionRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">Average across all courses</div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="content">Content Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Views Over Time</CardTitle>
                <CardDescription>Total views across all content</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <LineChart data={analyticsData.viewsOverTime} xKey="date" yKey="value" color="#3b82f6" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>Total revenue from all courses</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <LineChart data={analyticsData.revenueOverTime} xKey="date" yKey="value" color="#10b981" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Courses</CardTitle>
                <CardDescription>By number of students</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <BarChart data={analyticsData.coursePerformance} xKey="name" yKey="students" color="#8b5cf6" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Demographics</CardTitle>
                <CardDescription>Geographic distribution</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <PieChart data={analyticsData.studentDemographics} nameKey="name" valueKey="value" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Usage</CardTitle>
                <CardDescription>How students access your content</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <PieChart data={analyticsData.deviceUsage} nameKey="name" valueKey="value" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Revenue by course</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <BarChart data={analyticsData.coursePerformance} xKey="name" yKey="revenue" color="#10b981" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <LineChart data={analyticsData.revenueOverTime} xKey="date" yKey="value" color="#10b981" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Sources</CardTitle>
              <CardDescription>Breakdown by payment method and platform</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Detailed revenue source data coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Growth</CardTitle>
                <CardDescription>New students over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <LineChart data={analyticsData.studentsOverTime} xKey="date" yKey="value" color="#8b5cf6" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Demographics</CardTitle>
                <CardDescription>Geographic and demographic breakdown</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Geographic Distribution</h4>
                    <PieChart data={analyticsData.studentDemographics} nameKey="name" valueKey="value" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Device Usage</h4>
                    <PieChart data={analyticsData.deviceUsage} nameKey="name" valueKey="value" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Student Engagement</CardTitle>
              <CardDescription>Activity and completion metrics</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Detailed student engagement data coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Performance</CardTitle>
                <CardDescription>Students per course</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <BarChart data={analyticsData.coursePerformance} xKey="name" yKey="students" color="#3b82f6" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Engagement</CardTitle>
                <CardDescription>Views and completion rates</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <LineChart data={analyticsData.viewsOverTime} xKey="date" yKey="value" color="#3b82f6" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Content Feedback</CardTitle>
              <CardDescription>Ratings and reviews analysis</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Detailed content feedback data coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
