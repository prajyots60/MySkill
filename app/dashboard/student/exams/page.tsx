"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { 
  Clock, 
  Search, 
  FileQuestion,
  Eye, 
  Filter, 
  ArrowUpDown,
  BookOpen,
  Check,
  X,
  Calendar,
  Loader2
} from "lucide-react"

interface Course {
  id: string
  title: string
}

interface Exam {
  id: string
  title: string
  description?: string
  status: "DRAFT" | "PUBLISHED" | "CLOSED"
  type: "QUIZ" | "MCQ" | "ASSIGNMENT" | "FINAL"
  createdAt: string
  updatedAt: string
  passingScore?: number
  timeLimit?: number
  formId: string
  contentId?: string
  startDate?: string
  endDate?: string
  content?: {
    id: string
    title: string
  }
  hasAttempted?: boolean
  studentScore?: number | null
  studentPassed?: boolean | null
}

export default function StudentExamsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [exams, setExams] = useState<Exam[]>([])
  const [filteredExams, setFilteredExams] = useState<Exam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [courseFilter, setCourseFilter] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])

  // Fetch user's enrolled courses and their associated exams
  useEffect(() => {
    const fetchCoursesAndExams = async () => {
      try {
        setIsLoading(true)
        
        // Fetch exams directly using our new API endpoint
        const examResponse = await fetch("/api/student/exams")
        if (!examResponse.ok) throw new Error("Failed to fetch exams")
        const examData = await examResponse.json()
        
        if (examData && Array.isArray(examData.exams)) {
          setExams(examData.exams)
          setFilteredExams(examData.exams)
          
          // Extract unique courses from exams
          const uniqueCourses = Array.from(
            new Set(
              examData.exams
                .filter((exam: Exam) => exam.content)
                .map((exam: Exam) => JSON.stringify({ 
                  id: exam.content?.id, 
                  title: exam.content?.title 
                }))
            )
          ).map(str => JSON.parse(str))
          
          setCourses(uniqueCourses)
        }
      } catch (error) {
        console.error("Error fetching exams:", error)
        toast({
          title: "Error",
          description: "Failed to load your exams. Please try again later.",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (session?.user) {
      fetchCoursesAndExams()
    }
  }, [session])

  // Handle search and filtering
  useEffect(() => {
    if (exams.length === 0) return
    
    let filtered = [...exams]
    
    // Apply search filter
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase()
      filtered = filtered.filter(exam => 
        exam.title.toLowerCase().includes(searchTermLower) || 
        exam.description?.toLowerCase().includes(searchTermLower) ||
        exam.content?.title.toLowerCase().includes(searchTermLower)
      )
    }
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(exam => exam.status === statusFilter)
    }
    
    // Apply course filter
    if (courseFilter) {
      filtered = filtered.filter(exam => exam.contentId === courseFilter)
    }
    
    setFilteredExams(filtered)
  }, [searchTerm, statusFilter, courseFilter, exams])

  // Function to check if exam can be taken (scheduled start date has arrived)
  const canAccessExam = (exam: Exam): boolean => {
    try {
      // If no start date is set, assume it can be accessed immediately
      if (!exam.startDate) return true;
      
      const now = new Date();
      const examDate = new Date(exam.startDate);
      
      return examDate <= now;
    } catch (error) {
      console.error("Error checking exam access date:", error);
      return false; // Default to preventing access if there's an error
    }
  }

  // Format date for display
  const formatDateTime = (dateString?: string, fallback: string = "Immediately"): string => {
    if (!dateString) return fallback;
    
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return fallback;
    }
  }

  // Get exam status badge
  const getStatusBadge = (status: string, passed?: boolean | null, exam?: Exam) => {
    if (passed === true) {
      return <Badge className="bg-green-500 hover:bg-green-600">Passed</Badge>
    } else if (passed === false) {
      return <Badge variant="destructive">Failed</Badge>
    } else if (status === "PUBLISHED") {
      // If exam is provided, check if it's available based on start date
      if (exam && !canAccessExam(exam)) {
        return <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-200 border-violet-300">Upcoming</Badge>
      }
      return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Available</Badge>
    } else if (status === "CLOSED") {
      return <Badge variant="outline" className="border-gray-400 text-gray-600">Closed</Badge>
    } else {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300">Draft</Badge>
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex flex-col space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-9 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect to sign in
  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-500 text-transparent bg-clip-text">Course Exams</h1>
          <p className="text-muted-foreground">View and take exams from your enrolled courses.</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-purple-400" />
            <Input
              placeholder="Search exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 focus-visible:ring-purple-500"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 border-purple-200 hover:bg-purple-50">
                  <Filter className="h-4 w-4 text-purple-500" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("PUBLISHED")}>
                  Available Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("CLOSED")}>
                  Closed Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 border-indigo-200 hover:bg-indigo-50">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  Course
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCourseFilter(null)}>
                  All Courses
                </DropdownMenuItem>
                {courses.map(course => (
                  <DropdownMenuItem 
                    key={course.id} 
                    onClick={() => setCourseFilter(course.id)}
                  >
                    {course.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="upcoming" className="gap-1 data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4" />
              Upcoming Exams
            </TabsTrigger>
            <TabsTrigger value="taken" className="gap-1 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
              <Check className="h-4 w-4" />
              Completed Exams
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="whitespace-nowrap">Available From</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.filter(exam => !exam.hasAttempted && exam.status === "PUBLISHED").length > 0 ? (
                    filteredExams
                      .filter(exam => !exam.hasAttempted && exam.status === "PUBLISHED")
                      .map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">{exam.title}</TableCell>
                          <TableCell>{exam.content?.title || "N/A"}</TableCell>
                          <TableCell>{exam.type}</TableCell>
                          <TableCell>{exam.timeLimit ? `${exam.timeLimit} min` : "Unlimited"}</TableCell>
                          <TableCell>{formatDateTime(exam.startDate)}</TableCell>
                          <TableCell>{getStatusBadge(exam.status, null, exam)}</TableCell>
                          <TableCell>
                            {canAccessExam(exam) ? (
                              <Button asChild variant="outline" size="sm" className="gap-1 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300">
                                <Link href={`/exams/${exam.formId}/take`}>
                                  <Eye className="h-4 w-4" />
                                  Take Exam
                                </Link>
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                disabled
                                className="gap-1 opacity-70 cursor-not-allowed bg-slate-50 text-slate-500 border-slate-200"
                                onClick={() => {
                                  toast({
                                    title: "Exam Not Available Yet",
                                    description: `This exam will be available on ${formatDateTime(exam.startDate)}`,
                                    variant: "default"
                                  });
                                }}
                              >
                                <Calendar className="h-4 w-4" />
                                Not Available Yet
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No upcoming exams found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="taken" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Passing Score</TableHead>
                    <TableHead>Your Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.filter(exam => exam.hasAttempted).length > 0 ? (
                    filteredExams
                      .filter(exam => exam.hasAttempted)
                      .map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">{exam.title}</TableCell>
                          <TableCell>{exam.content?.title || "N/A"}</TableCell>
                          <TableCell>{exam.type}</TableCell>
                          <TableCell>{exam.passingScore ? `${exam.passingScore}%` : "N/A"}</TableCell>
                          <TableCell>
                            {exam.studentScore !== null && exam.studentScore !== undefined 
                              ? `${exam.studentScore}%` 
                              : "Pending"}
                          </TableCell>
                          <TableCell>{getStatusBadge(exam.status, exam.studentPassed, exam)}</TableCell>
                          <TableCell>
                            <Button asChild variant="outline" size="sm" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 hover:border-indigo-300">
                              <Link href={`/exams/${exam.formId}/results`}>
                                <Eye className="h-4 w-4" />
                                View Results
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No completed exams found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
