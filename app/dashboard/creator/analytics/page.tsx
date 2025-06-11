"use client"

import { useState, useMemo, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, TrendingUp, Users, Eye, Clock, Download, DollarSign, Info } from "lucide-react"
import { useCreatorCourses, useCreatorEarnings } from "@/lib/react-query/queries"
import { BarChart, LineChart, PieChart } from "./charts"

export default function AnalyticsDashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [timeRange, setTimeRange] = useState("30days")
  const [selectedCourse, setSelectedCourse] = useState("all")

  // Fetch courses data
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()
  
  // Fetch earnings data with react-query
  const { data: earningsData, refetch: refetchEarnings } = useCreatorEarnings({
    timeRange: timeRange as "30days" | "7days" | "90days" | "year" | "all" | undefined,
    transactionType: "all"
  })

  // Refetch data when timeRange changes
  useEffect(() => {
    refetchEarnings();
  }, [timeRange, refetchEarnings]);

  // Calculate total students from courses data
  const totalStudents = courses ? courses.reduce(
    (acc: number, course: any) => acc + (course.enrollmentCount || 0), 
    0
  ) : 0

  // Calculate real-time course revenue data
  const courseRevenueData = useMemo(() => {
    if (!courses || !earningsData?.courseEarnings) return [];
    
    // For debugging - check the structure of the earnings data
    console.log("Courses data:", courses);
    console.log("Course earnings data:", earningsData.courseEarnings);
    
    // If we have direct courseEarnings data from the API and it's in the right format, use it
    if (earningsData.courseEarnings && earningsData.courseEarnings.length > 0 && 
        typeof earningsData.courseEarnings[0].value === 'number') {
      
      const enrichedCourseEarnings = earningsData.courseEarnings.map((ce: any) => {
        // Find the corresponding course to get additional info like student count
        const matchingCourse = courses?.find((course: any) => 
          course.id === ce.courseId || course.title === ce.name
        );
        
        return {
          ...ce,
          revenue: ce.value,
          students: matchingCourse?.enrollmentCount || 0
        };
      });
      
      return enrichedCourseEarnings.sort((a: any, b: any) => b.value - a.value).slice(0, 5);
    }
    
    // Fallback: Map courses to the earning data format
    const mappedCourses = courses.map((course: any) => {
      // Try to find matching course earnings from API data
      const courseEarning = earningsData.courseEarnings?.find(
        (ce: any) => ce.courseId === course.id || ce.name === course.title
      );
      
      const value = courseEarning?.value || 0;
      
      return {
        name: course.title,
        value: value, // This matches the API's courseEarnings structure
        revenue: value, // Keep this for our internal use
        students: course.enrollmentCount || 0
      };
    });
    
    return mappedCourses.sort((a: any, b: any) => b.value - a.value).slice(0, 5); // Top 5 courses by revenue
  }, [courses, earningsData?.courseEarnings]);

  // Calculate the total revenue from course earnings
  const { calculatedgrossRevenue } = useMemo(() => {
    if (!earningsData?.courseEarnings || earningsData.courseEarnings.length === 0) {
      return {
        calculatedgrossRevenue: earningsData?.totalEarnings || 0
      };
    }
    
    // Sum up all course earnings for more accurate total (gross revenue)
    const calculatedTotal = earningsData.courseEarnings.reduce((total, course) => total + (course.value || 0), 0);
    
    // Debug: Log the values and discrepancy 
    if (earningsData?.totalEarnings) {
      console.log('API totalEarnings:', earningsData.totalEarnings);
      console.log('Calculated total gross revenue:', calculatedTotal);
    }
    
    return {
      calculatedgrossRevenue: calculatedTotal
    };
  }, [earningsData]);

  // Analytics data with real-time values where possible
  const analyticsData = {
    totalStudents: totalStudents, // Real student count data
    grossRevenue: calculatedgrossRevenue, // Gross revenue (before platform cut)
    completionRate: 68, // Still mock data
    averageRating: 4.7, // Still mock data
    viewsGrowth: 24, // Still mock data 
    studentsGrowth: 18, // Still mock data
    revenueGrowth: earningsData?.earningsGrowth || 0, // Real growth data

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

    // Real revenue over time data if available, otherwise fallback to mock data
    revenueOverTime: earningsData?.earningsOverTime?.length 
      ? earningsData.earningsOverTime 
      : [
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

    // Use real course performance data if available, otherwise fall back to calculated data or mock
    coursePerformance: courseRevenueData.length > 0 
      ? courseRevenueData 
      : [
          { name: "Web Development", students: 320, revenue: 3200, value: 3200 },
          { name: "Data Science", students: 180, revenue: 1800, value: 1800 },
          { name: "Mobile App Dev", students: 140, revenue: 1400, value: 1400 },
          { name: "UI/UX Design", students: 120, revenue: 1200, value: 1200 },
          { name: "Digital Marketing", students: 80, revenue: 800, value: 800 },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Revenue</CardTitle>
            <div className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-help" title="Total sales before platform commission">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${analyticsData.grossRevenue.toLocaleString()}</div>
                <div className="text-xs flex items-center mt-1" style={{ color: analyticsData.revenueGrowth >= 0 ? '#10b981' : '#ef4444' }}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {analyticsData.revenueGrowth}% from {timeRange === "7days" ? "last week" : 
                                                    timeRange === "30days" ? "last month" : 
                                                    timeRange === "90days" ? "last quarter" : 
                                                    timeRange === "year" ? "last year" : "previous period"}
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
                <CardDescription>
                  {timeRange === "7days" && "Last 7 days revenue"}
                  {timeRange === "30days" && "Last 30 days revenue"}
                  {timeRange === "90days" && "Last 90 days revenue"}
                  {timeRange === "year" && "Last year revenue"}
                  {timeRange === "all" && "All-time revenue"}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <LineChart data={analyticsData.revenueOverTime} xKey="date" yKey="value" color="#10b981" />
                {analyticsData.revenueOverTime.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No revenue data available for selected time range</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Top Performing Courses</CardTitle>
                  <CardDescription>By {selectedCourse === 'all' ? 'revenue' : 'number of students'}</CardDescription>
                </div>
                <Select 
                  value={selectedCourse === 'all' ? 'revenue' : 'students'} 
                  onValueChange={(val) => {
                    // This is just for the chart display type, not actual course selection
                    // selectedCourse is still used for filtering elsewhere
                  }}
                  >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="h-[300px]">
                <BarChart 
                  data={courseRevenueData.length > 0 ? courseRevenueData : analyticsData.coursePerformance} 
                  xKey="name" 
                  yKey={selectedCourse === 'all' ? 'value' : 'students'} 
                  color="#8b5cf6" 
                />
                {courseRevenueData.length === 0 && analyticsData.coursePerformance.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No course performance data available</p>
                  </div>
                )}
                {/* Display top courses with values */}
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  {(courseRevenueData.length > 0 ? courseRevenueData : analyticsData.coursePerformance).slice(0, 3).map((course: any, index: number) => (
                    <div key={index} className="flex flex-col items-center">
                      <span className="font-medium truncate max-w-full">{course.name}</span>
                      {selectedCourse === 'all' ? (
                        <span className="text-purple-500">${course.value.toLocaleString()}</span>
                      ) : (
                        <span className="text-blue-500">{course.students.toLocaleString()} students</span>
                      )}
                    </div>
                  ))}
                </div>
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
                <BarChart 
                  data={courseRevenueData.length > 0 ? courseRevenueData : analyticsData.coursePerformance} 
                  xKey="name" 
                  yKey="value" 
                  color="#10b981" 
                />
                {courseRevenueData.length === 0 && analyticsData.coursePerformance.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No course revenue data available</p>
                  </div>
                )}
                {/* Display values above bars */}
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {(courseRevenueData.length > 0 ? courseRevenueData : analyticsData.coursePerformance).slice(0, 3).map((course: any, index: number) => (
                    <div key={index} className="flex flex-col items-center">
                      <span className="font-medium truncate max-w-full">{course.name}</span>
                      <span className="text-green-500">${course.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              {earningsData && earningsData.metrics && (
                <CardFooter className="pt-0">
                  <div className="w-full flex flex-wrap justify-between text-sm text-muted-foreground">
                    <div>Total Sales: <span className="font-medium">{earningsData.metrics.totalSales}</span></div>
                    <div>Refunds: <span className="font-medium">{earningsData.metrics.totalRefunds}</span></div>
                    <div>Pending: <span className="font-medium">{earningsData.metrics.pendingTransactions}</span></div>
                    <div>Conversion Rate: <span className="font-medium">{earningsData.metrics.conversionRate}%</span></div>
                  </div>
                </CardFooter>
              )}
              {!earningsData?.metrics && (
                <CardFooter className="pt-0">
                  <div className="text-sm text-muted-foreground flex flex-col gap-1">
                    <p>Gross Revenue: ${calculatedgrossRevenue.toLocaleString()}</p>
                  </div>
                </CardFooter>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <LineChart data={analyticsData.revenueOverTime} xKey="date" yKey="value" color="#10b981" />
              </CardContent>
              {earningsData && (
                <CardFooter className="pt-0">
                  <div className="w-full flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <div>Total Revenue: <span className="font-medium">${calculatedgrossRevenue.toLocaleString()}</span></div>
                      <div>Growth: <span className="font-medium text-green-500">{earningsData.earningsGrowth}%</span></div>
                    </div>
                  </div>
                </CardFooter>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Sources</CardTitle>
              <CardDescription>Breakdown by payment method and platform</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col items-center justify-center">
              {earningsData && earningsData.pendingPayouts && earningsData.pendingPayouts > 0 ? (
                <>
                  <div className="text-xl font-semibold mb-2">${earningsData.pendingPayouts.toLocaleString()}</div>
                  <p className="text-center text-muted-foreground">
                    Pending payout amount. Last payout: ${earningsData.lastPayout.toLocaleString()} on {
                    earningsData.lastPayoutDate ? new Date(earningsData.lastPayoutDate).toLocaleDateString() : 'N/A'
                    }
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Detailed revenue source data coming soon</p>
              )}
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
