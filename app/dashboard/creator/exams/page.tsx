"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  BookOpen, 
  Clock, 
  Edit, 
  FileQuestion, 
  Filter, 
  FilePlus, 
  LayoutGrid, 
  List, 
  Loader2, 
  Search, 
  Settings, 
  Users, 
  Trash,
  Plus,
  ChevronDown,
  FileText,
  Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Added TabsTrigger
import { SelectItem } from "@/components/ui/select";
import ExamCreator from "@/components/exam-creator"; // Changed to default import
import { formatDate } from "@/lib/utils/format"
 // Assuming formatDate is in lib/utils - this might need a specific path if not directly in utils

interface Exam {
  id: string
  title: string
  description?: string
  status: "DRAFT" | "PUBLISHED" | "CLOSED"
  createdAt: string
  updatedAt: string
  questionCount?: number
  responseCount?: number
  formId?: string
  courseId?: string
  sectionId?: string
}

export default function CreatorExamsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [exams, setExams] = useState<Exam[]>([])
  const [filteredExams, setFilteredExams] = useState<Exam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [courseFilter, setCourseFilter] = useState<string | null>(null) // New state for course filter
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showExamCreator, setShowExamCreator] = useState(false)
  const [examCreated, setExamCreated] = useState<{
    examId: string;
    formId: string;
    formUrl: string;
  } | null>(null)
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [sections, setSections] = useState<{ id: string; title: string; courseId: string }[]>([])
  
  // New state for exam creation (replacing the modal dialog data)
  const [newExam, setNewExam] = useState({
    title: "",
    description: "",
    type: "QUIZ",
    passingScore: "70",
    timeLimit: "30",
    courseId: "",
    sectionId: ""
  });

  // Safely display SelectItem components to prevent empty string errors
  const renderSelectItems = (items: { id: string; title: string }[]) => {
    if (!items || items.length === 0) {
      return <SelectItem value="none">None Available</SelectItem>;
    }

    return items.map(item => (
      <SelectItem key={item.id} value={item.id || "none"}>{item.title || "Unnamed Item"}</SelectItem>
    ));
  };

  // Fetch exams
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/creator/exams")
        
        if (!response.ok) {
          throw new Error("Failed to fetch exams")
        }
        
        const data = await response.json()
        
        if (data.success && data.exams) {
          setExams(data.exams)
          setFilteredExams(data.exams)
        } else {
          throw new Error(data.message || "Failed to fetch exams")
        }
      } catch (error) {
        console.error("Error fetching exams:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load exams",
          variant: "destructive",
        })
        setExams([])
        setFilteredExams([])
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchExams()
  }, [toast])
  
  // Fetch courses for exam creation
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        // Add cache-busting parameter to ensure fresh data
        const timestamp = new Date().getTime()
        const response = await fetch(`/api/creator/courses?t=${timestamp}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch courses")
        }
        
        const data = await response.json()
        
        if (data.success && data.courses) {
          setCourses(data.courses)
        }
      } catch (error) {
        console.error("Error fetching courses:", error)
      }
    }
    
    fetchCourses()
  }, [])
  
  // Handle search and filtering
  useEffect(() => {
    let results = [...exams]
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      results = results.filter(exam => 
        exam.title.toLowerCase().includes(searchLower) || 
        (exam.description && exam.description.toLowerCase().includes(searchLower))
      )
    }
    
    // Apply status filter
    if (statusFilter) {
      results = results.filter(exam => exam.status === statusFilter)
    }

    // Apply course filter
    if (courseFilter) {
      results = results.filter(exam => exam.courseId === courseFilter)
    }
    
    setFilteredExams(results)
  }, [searchTerm, statusFilter, courseFilter, exams, courses]) // Added courseFilter and courses
  
  // Handle exam creation completion
  const handleExamCreated = (examId: string, formId: string, formUrl: string) => {
    setExamCreated({
      examId,
      formId,
      formUrl
    })
    
    // Add the new exam to the list
    const newExamObj: Exam = {
      id: examId,
      title: newExam.title, // Use the title from our state
      description: newExam.description,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      formId: formId,
      questionCount: 0,
      responseCount: 0
    }
    
    setExams([newExamObj, ...exams])
    setFilteredExams([newExamObj, ...filteredExams])
    
    toast({
      title: "Success",
      description: "Exam created successfully. You can now add questions.",
    })
    
    // Navigate to the edit page for the new exam
    router.push(`/exams/${formId}/edit`)
  }
  
  // Handle exam deletion
  const confirmDelete = (exam: Exam) => {
    setExamToDelete(exam)
    setDeleteDialogOpen(true)
  }
  
  const handleDeleteExam = async () => {
    if (!examToDelete) return
    
    try {
      setIsDeleting(true)
      
      const response = await fetch(`/api/exams/${examToDelete.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete exam")
      }
      
      // Remove the deleted exam from state
      setExams(exams.filter(e => e.id !== examToDelete.id))
      setFilteredExams(filteredExams.filter(e => e.id !== examToDelete.id))
      
      toast({
        title: "Success",
        description: "Exam deleted successfully",
      })
      
      setDeleteDialogOpen(false)
      setExamToDelete(null)
    } catch (error) {
      console.error("Error deleting exam:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete exam",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }
  
  // Clear filters
  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter(null)
    setCourseFilter(null) // Reset course filter
  }
  
  // Create new exam (replaces the modal dialog handler)
  const handleCreateNewExam = () => {
    setShowExamCreator(true);
  }

  // Render exam card view
  const renderExamCards = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredExams.map((exam) => {
          const course = courses.find(c => c.id === exam.courseId);
          const courseTitle = course ? course.title : "N/A";
          return (
            <Card key={exam.id} className="flex flex-col h-full border-indigo-100 dark:border-indigo-900/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
              <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 border-b border-indigo-100 dark:border-indigo-900/30">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    <Link href={`/dashboard/creator/exams/${exam.id}`}>
                      {exam.title}
                    </Link>
                  </CardTitle>
                  <Badge variant={
                    exam.status === "DRAFT" 
                      ? "secondary" 
                      : exam.status === "PUBLISHED" 
                        ? "default" 
                        : "destructive"
                  } className={
                    exam.status === "DRAFT" 
                      ? "bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50" 
                      : exam.status === "PUBLISHED" 
                        ? "bg-green-100 border-green-200 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50"
                        : ""
                  }>
                    {exam.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 mt-1">
                  {exam.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow text-sm pb-2 pt-4">
                <div className="space-y-3">
                  <div className="flex gap-2 text-muted-foreground">
                    <BookOpen className="h-4 w-4 mt-0.5 text-sky-400" />
                    <span>Course: {courseTitle}</span>
                  </div>
                  <div className="flex gap-2 text-muted-foreground">
                    <FileQuestion className="h-4 w-4 mt-0.5 text-indigo-400" />
                    <span>{exam.questionCount || 0} Question{(exam.questionCount || 0) !== 1 ? "s" : ""}</span>
                  </div>
                  
                  <div className="flex gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 mt-0.5 text-violet-400" />
                    <span>{exam.responseCount || 0} Response{(exam.responseCount || 0) !== 1 ? "s" : ""}</span>
                  </div>
                  
                  <div className="flex gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 mt-0.5 text-indigo-400" />
                    <span>Created: {formatDate(new Date(exam.createdAt))}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 mt-2 border-t border-indigo-100 dark:border-indigo-900/30">
                <div className="flex justify-between w-full">
                  {exam.status === "PUBLISHED" || exam.status === "CLOSED" ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                      className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300 dark:border-indigo-800/40 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      <Link href={`/exams/${exam.formId}/results`}>
                        <FileText className="h-4 w-4 mr-1" />
                        Results
                      </Link>
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                      className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300 dark:border-indigo-800/40 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      <Link href={`/exams/${exam.formId}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-indigo-100 shadow-lg min-w-[180px]">
                      <DropdownMenuLabel className="text-indigo-800 dark:text-indigo-300">Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-indigo-100 dark:bg-indigo-800/40" />
                      {exam.status === "DRAFT" && (
                        <DropdownMenuItem asChild className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                          <Link href={`/exams/${exam.formId}/edit`}>
                            <Edit className="h-4 w-4 mr-2 text-indigo-500" />
                            Edit Exam
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {exam.status === "PUBLISHED" && (
                        <>
                          <DropdownMenuItem asChild className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                            <Link href={`/exams/${exam.formId}/take`} target="_blank">
                              <Eye className="h-4 w-4 mr-2 text-indigo-500" />
                              Preview
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                            <Link href={`/exams/${exam.formId}/results`}>
                              <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                              View Results
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      {exam.status === "CLOSED" && (
                        <DropdownMenuItem asChild className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                          <Link href={`/exams/${exam.formId}/results`}>
                            <FileText className="h-4 w-4 mr-2 text-indigo-500" />
                            View Results
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {exam.status === "DRAFT" && (
                        <DropdownMenuItem 
                          onClick={() => confirmDelete(exam)} 
                          className="text-red-600 hover:text-red-700 focus:text-red-700 hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Exam
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    )
  }
  
  // Render exam list view
  const renderExamList = () => {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left font-medium">Exam / Course</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Questions</th>
                <th className="px-4 py-2 text-left font-medium">Responses</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam) => {
                const course = courses.find(c => c.id === exam.courseId);
                const courseTitle = course ? course.title : "N/A";
                return (
                  <tr key={exam.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <Link href={`/dashboard/creator/exams/${exam.id}`} className="font-medium hover:underline">
                          {exam.title}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {courseTitle !== "N/A" ? `Course: ${courseTitle}` : "No course assigned"}
                        </p>
                        {exam.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{exam.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        exam.status === "DRAFT" ? "secondary" : 
                        exam.status === "PUBLISHED" ? "default" : 
                        "destructive"
                      }>
                        {exam.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{exam.questionCount || 0}</td>
                    <td className="px-4 py-3">{exam.responseCount || 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(new Date(exam.createdAt))}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {exam.status === "DRAFT" ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                          >
                            <Link href={`/exams/${exam.formId}/edit`}>
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Link>
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                          >
                            <Link href={`/exams/${exam.formId}/results`}>
                              <FileText className="h-4 w-4 mr-1" />
                              Results
                            </Link>
                          </Button>
                        )}
                        
                        {exam.status === "DRAFT" && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => confirmDelete(exam)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredExams.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-t">
            <p>No exams match your filters</p>
          </div>
        )}
      </div>
    )
  }
   // If the ExamCreator is showing, only display that
  if (showExamCreator) {
    return (
      <div className="container py-10 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">Create New Exam</h1>
            <p className="text-muted-foreground mt-1">Create a comprehensive assessment for your students</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowExamCreator(false)}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300 dark:border-indigo-800/40 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            Back to Exams
          </Button>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-50/30 to-violet-50/30 dark:from-indigo-950/10 dark:to-violet-950/10 rounded-xl p-5 shadow-inner">
          <ExamCreator 
            contentId={newExam.courseId !== "" ? newExam.courseId : undefined} 
            sectionId={newExam.sectionId !== "" ? newExam.sectionId : undefined}
            examTitle={newExam.title}
            examDescription={newExam.description}
            examType={newExam.type}
            passingScore={parseInt(newExam.passingScore) || 70}
            timeLimit={parseInt(newExam.timeLimit) || 30}
            onExamCreated={handleExamCreated}
            requireCourse={true}
            courses={courses}
            onCourseChange={(courseId: string) => { // Added type for courseId
              setNewExam({
                ...newExam,
                courseId: courseId,
                sectionId: "" // Reset section when course changes
              });
            }}
          />
        </div>
      </div>
    )
  }
  
  return (
    <div className="container py-10 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">Exams</h1>
          <p className="text-muted-foreground mt-1">Create and manage assessments for your students</p>
        </div>
        
        <Button onClick={handleCreateNewExam} className="bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600 text-white shadow-md">
          <FilePlus className="h-4 w-4 mr-2" />
          Create New Exam
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-indigo-400" />
          <Input 
            placeholder="Search exams..." 
            className="pl-9 border-indigo-100 bg-white dark:bg-slate-900 focus-visible:ring-violet-500 rounded-md" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-indigo-200 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                <Filter className="h-4 w-4 mr-2 text-indigo-500" />
                Status
                {statusFilter && <Badge variant="secondary" className="ml-2 bg-violet-100 text-violet-700">{statusFilter}</Badge>}
                <ChevronDown className="h-4 w-4 ml-2 text-indigo-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-indigo-100 shadow-lg">
              <DropdownMenuItem onClick={() => setStatusFilter(null)} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("DRAFT")} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("PUBLISHED")} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                Published
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("CLOSED")} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                Closed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-indigo-200 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                <BookOpen className="h-4 w-4 mr-2 text-indigo-500" />
                Course
                {courseFilter && <Badge variant="secondary" className="ml-2 bg-violet-100 text-violet-700">{courses.find(c => c.id === courseFilter)?.title || 'Unknown Course'}</Badge>}
                <ChevronDown className="h-4 w-4 ml-2 text-indigo-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-indigo-100 shadow-lg">
              <DropdownMenuItem onClick={() => setCourseFilter(null)} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30">
                All Courses
              </DropdownMenuItem>
              {courses.map(course => (
                <DropdownMenuItem 
                  key={course.id} 
                  onClick={() => setCourseFilter(course.id)}
                  className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus:bg-indigo-50 dark:focus:bg-indigo-950/30"
                >
                  {course.title}
                </DropdownMenuItem>
              ))}
              {courses.length === 0 && (
                <DropdownMenuItem disabled className="text-muted-foreground">No courses available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {(searchTerm || statusFilter || courseFilter) && ( // Added courseFilter
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            >
              Clear Filters
            </Button>
          )}
          
          <div className="border border-indigo-200 rounded-md overflow-hidden flex">
            <Button 
              variant={viewMode === "grid" ? "default" : "ghost"} 
              size="sm" 
              className={`rounded-none px-3 ${
                viewMode === "grid" 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "default" : "ghost"} 
              size="sm" 
              className={`rounded-none px-3 ${
                viewMode === "list" 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-16 my-4">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your exams...</p>
          </div>
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-xl p-10 text-center shadow-sm my-6">
          <FileQuestion className="h-16 w-16 mx-auto mb-5 text-indigo-400" />
          <h2 className="text-2xl font-semibold mb-3 text-indigo-900 dark:text-indigo-200">No Exams Created Yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first exam to assess students' knowledge and track their progress through your courses.
          </p>
          <Button 
            onClick={handleCreateNewExam}
            className="bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600 text-white shadow-md px-5 py-6"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Exam
          </Button>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/10 dark:to-violet-950/10 rounded-xl p-8 text-center my-6">
          <Search className="h-12 w-12 mx-auto mb-4 text-indigo-300" />
          <h2 className="text-xl font-medium mb-2 text-indigo-800 dark:text-indigo-200">No Matching Exams</h2>
          <p className="text-muted-foreground mb-4">
            No exams match your current search and filters.
          </p>
          <Button 
            variant="outline" 
            onClick={clearFilters}
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/30"
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Tabs defaultValue="all">
            <div className="border-b border-indigo-100 dark:border-indigo-900/30">
              <TabsList className="mb-0 bg-transparent h-12 p-0">
                <TabsTrigger 
                  value="all" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-none rounded-none h-12 px-5 bg-transparent text-muted-foreground"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  All Exams ({filteredExams.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="draft" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-none rounded-none h-12 px-5 bg-transparent text-muted-foreground"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Drafts ({filteredExams.filter(e => e.status === "DRAFT").length})
                </TabsTrigger>
                <TabsTrigger 
                  value="published" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-none rounded-none h-12 px-5 bg-transparent text-muted-foreground"
                >
                  <FileQuestion className="h-4 w-4 mr-2" />
                  Published ({filteredExams.filter(e => e.status === "PUBLISHED").length})
                </TabsTrigger>
                <TabsTrigger 
                  value="closed" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-none rounded-none h-12 px-5 bg-transparent text-muted-foreground"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Closed ({filteredExams.filter(e => e.status === "CLOSED").length})
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="all">
              {viewMode === "grid" ? renderExamCards() : renderExamList()}
            </TabsContent>
            
            <TabsContent value="draft">
              {viewMode === "grid" 
                ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExams.filter(e => e.status === "DRAFT").map(exam => (
                      <Card key={exam.id} className="flex flex-col h-full">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">
                              <Link href={`/exams/${exam.formId}/edit`}>
                                {exam.title}
                              </Link>
                            </CardTitle>
                            <Badge variant="secondary">DRAFT</Badge>
                          </div>
                          <CardDescription>
                            {exam.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow text-sm pb-2">
                          <div className="space-y-2">
                            <div className="flex gap-1 text-muted-foreground">
                              <FileQuestion className="h-4 w-4 mt-0.5" />
                              <span>{exam.questionCount || 0} Question{(exam.questionCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                            
                            <div className="flex gap-1 text-muted-foreground">
                              <Clock className="h-4 w-4 mt-0.5" />
                              <span>Created: {formatDate(new Date(exam.createdAt))}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <div className="flex justify-between w-full">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              asChild
                            >
                              <Link href={`/exams/${exam.formId}/edit`}>
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => confirmDelete(exam)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                : <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left font-medium">Exam</th>
                          <th className="px-4 py-2 text-left font-medium">Questions</th>
                          <th className="px-4 py-2 text-left font-medium">Created</th>
                          <th className="px-4 py-2 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExams.filter(e => e.status === "DRAFT").map((exam) => (
                          <tr key={exam.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div>
                                <Link href={`/exams/${exam.formId}/edit`} className="font-medium hover:underline">
                                  {exam.title}
                                </Link>
                                {exam.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{exam.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{exam.questionCount || 0}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(new Date(exam.createdAt))}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  asChild
                                >
                                  <Link href={`/exams/${exam.formId}/edit`}>
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Link>
                                </Button>
                                
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => confirmDelete(exam)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredExams.filter(e => e.status === "DRAFT").length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-t">
                        <p>No draft exams found</p>
                      </div>
                    )}
                  </div>
              }
            </TabsContent>
            
            <TabsContent value="published">
              {viewMode === "grid" 
                ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExams.filter(e => e.status === "PUBLISHED").map(exam => (
                      <Card key={exam.id} className="flex flex-col h-full">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">
                              <Link href={`/exams/${exam.formId}/results`}>
                                {exam.title}
                              </Link>
                            </CardTitle>
                            <Badge variant="default">PUBLISHED</Badge>
                          </div>
                          <CardDescription>
                            {exam.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow text-sm pb-2">
                          <div className="space-y-2">
                            <div className="flex gap-1 text-muted-foreground">
                              <FileQuestion className="h-4 w-4 mt-0.5" />
                              <span>{exam.questionCount || 0} Question{(exam.questionCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                            
                            <div className="flex gap-1 text-muted-foreground">
                              <Users className="h-4 w-4 mt-0.5" />
                              <span>{exam.responseCount || 0} Response{(exam.responseCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                            
                            <div className="flex gap-1 text-muted-foreground">
                              <Clock className="h-4 w-4 mt-0.5" />
                              <span>Created: {formatDate(new Date(exam.createdAt))}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            className="flex-1"
                          >
                            <Link href={`/exams/${exam.formId}/results`}>
                              <FileText className="h-4 w-4 mr-1" />
                              Results
                            </Link>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                          >
                            <Link href={`/exams/${exam.formId}/take`} target="_blank">
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Preview</span>
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                : <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left font-medium">Exam</th>
                          <th className="px-4 py-2 text-left font-medium">Questions</th>
                          <th className="px-4 py-2 text-left font-medium">Responses</th>
                          <th className="px-4 py-2 text-left font-medium">Created</th>
                          <th className="px-4 py-2 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExams.filter(e => e.status === "PUBLISHED").map((exam) => (
                          <tr key={exam.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div>
                                <Link href={`/exams/${exam.formId}/results`} className="font-medium hover:underline">
                                  {exam.title}
                                </Link>
                                {exam.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{exam.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{exam.questionCount || 0}</td>
                            <td className="px-4 py-3">{exam.responseCount || 0}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(new Date(exam.createdAt))}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  asChild
                                >
                                  <Link href={`/exams/${exam.formId}/results`}>
                                    <FileText className="h-4 w-4 mr-1" />
                                    Results
                                  </Link>
                                </Button>
                                
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  asChild
                                >
                                  <Link href={`/exams/${exam.formId}/take`} target="_blank">
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">Preview</span>
                                  </Link>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredExams.filter(e => e.status === "PUBLISHED").length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-t">
                        <p>No published exams found</p>
                      </div>
                    )}
                  </div>
              }
            </TabsContent>
            
            <TabsContent value="closed">
              {viewMode === "grid" 
                ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExams.filter(e => e.status === "CLOSED").map(exam => (
                      <Card key={exam.id} className="flex flex-col h-full">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">
                              <Link href={`/exams/${exam.formId}/results`}>
                                {exam.title}
                              </Link>
                            </CardTitle>
                            <Badge variant="destructive">CLOSED</Badge>
                          </div>
                          <CardDescription>
                            {exam.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow text-sm pb-2">
                          <div className="space-y-2">
                            <div className="flex gap-1 text-muted-foreground">
                              <FileQuestion className="h-4 w-4 mt-0.5" />
                              <span>{exam.questionCount || 0} Question{(exam.questionCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                            
                            <div className="flex gap-1 text-muted-foreground">
                              <Users className="h-4 w-4 mt-0.5" />
                              <span>{exam.responseCount || 0} Response{(exam.responseCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                            
                            <div className="flex gap-1 text-muted-foreground">
                              <Clock className="h-4 w-4 mt-0.5" />
                              <span>Created: {formatDate(new Date(exam.createdAt))}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            className="w-full"
                          >
                            <Link href={`/exams/${exam.formId}/results`}>
                              <FileText className="h-4 w-4 mr-1" />
                              View Results
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                : <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left font-medium">Exam</th>
                          <th className="px-4 py-2 text-left font-medium">Questions</th>
                          <th className="px-4 py-2 text-left font-medium">Responses</th>
                          <th className="px-4 py-2 text-left font-medium">Created</th>
                          <th className="px-4 py-2 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExams.filter(e => e.status === "CLOSED").map((exam) => (
                          <tr key={exam.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div>
                                <Link href={`/exams/${exam.formId}/results`} className="font-medium hover:underline">
                                  {exam.title}
                                </Link>
                                {exam.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{exam.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{exam.questionCount || 0}</td>
                            <td className="px-4 py-3">{exam.responseCount || 0}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(new Date(exam.createdAt))}</td>
                            <td className="px-4 py-3">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                asChild
                              >
                                <Link href={`/exams/${exam.formId}/results`}>
                                  <FileText className="h-4 w-4 mr-1" />
                                  View Results
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredExams.filter(e => e.status === "CLOSED").length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-t">
                        <p>No closed exams found</p>
                      </div>
                    )}
                  </div>
              }
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}