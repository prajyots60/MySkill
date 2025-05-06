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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ExamCreator from "@/components/exam-creator"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils/format"

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
    
    setFilteredExams(results)
  }, [searchTerm, statusFilter, exams])
  
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
  }
  
  // Create new exam (replaces the modal dialog handler)
  const handleCreateNewExam = () => {
    setShowExamCreator(true);
  }

  // Render exam card view
  const renderExamCards = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExams.map((exam) => (
          <Card key={exam.id} className="flex flex-col h-full">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">
                  <Link href={`/dashboard/creator/exams/${exam.id}`}>
                    {exam.title}
                  </Link>
                </CardTitle>
                <Badge variant={
                  exam.status === "DRAFT" ? "secondary" : 
                  exam.status === "PUBLISHED" ? "default" : 
                  "destructive"
                }>
                  {exam.status}
                </Badge>
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
              <div className="flex justify-between w-full">
                {exam.status === "PUBLISHED" || exam.status === "CLOSED" ? (
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
                ) : (
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
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {exam.status === "DRAFT" && (
                      <DropdownMenuItem asChild>
                        <Link href={`/exams/${exam.formId}/edit`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Exam
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {exam.status === "PUBLISHED" && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href={`/exams/${exam.formId}/take`} target="_blank">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/exams/${exam.formId}/results`}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Results
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {exam.status === "CLOSED" && (
                      <DropdownMenuItem asChild>
                        <Link href={`/exams/${exam.formId}/results`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Results
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {exam.status === "DRAFT" && (
                      <DropdownMenuItem onClick={() => confirmDelete(exam)} className="text-destructive focus:text-destructive">
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Exam
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardFooter>
          </Card>
        ))}
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
                <th className="px-4 py-2 text-left font-medium">Exam</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Questions</th>
                <th className="px-4 py-2 text-left font-medium">Responses</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <Link href={`/dashboard/creator/exams/${exam.id}`} className="font-medium hover:underline">
                        {exam.title}
                      </Link>
                      {exam.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{exam.description}</p>
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
              ))}
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
      <div className="container py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Create New Exam</h1>
            <p className="text-muted-foreground">Create a new exam for your students</p>
          </div>
          <Button variant="outline" onClick={() => setShowExamCreator(false)}>
            Back to Exams
          </Button>
        </div>
        
        <ExamCreator 
          contentId={newExam.courseId !== "" ? newExam.courseId : undefined} 
          sectionId={newExam.sectionId !== "" ? newExam.sectionId : undefined}
          examTitle={newExam.title}
          examDescription={newExam.description}
          examType={newExam.type}
          passingScore={parseInt(newExam.passingScore) || 70}
          timeLimit={parseInt(newExam.timeLimit) || 30}
          onExamCreated={handleExamCreated}
        />
      </div>
    )
  }
  
  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Exams</h1>
          <p className="text-muted-foreground">Create and manage your exams</p>
        </div>
        
        <Button onClick={handleCreateNewExam}>
          <FilePlus className="h-4 w-4 mr-2" />
          Create New Exam
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search exams..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Status
                {statusFilter && <Badge variant="secondary" className="ml-2">{statusFilter}</Badge>}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("DRAFT")}>
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("PUBLISHED")}>
                Published
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("CLOSED")}>
                Closed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {(searchTerm || statusFilter) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
          
          <div className="border rounded-md overflow-hidden flex">
            <Button 
              variant={viewMode === "grid" ? "default" : "ghost"} 
              size="sm" 
              className="rounded-none px-2"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "default" : "ghost"} 
              size="sm" 
              className="rounded-none px-2"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-muted rounded-lg p-8 text-center">
          <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-medium mb-2">No Exams Created Yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first exam to assess students' knowledge and track their progress.
          </p>
          <Button onClick={handleCreateNewExam}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Exam
          </Button>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-medium mb-2">No Matching Exams</h2>
          <p className="text-muted-foreground mb-4">
            No exams match your current search and filters.
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                <BookOpen className="h-4 w-4 mr-2" />
                All Exams ({filteredExams.length})
              </TabsTrigger>
              <TabsTrigger value="draft">
                <Edit className="h-4 w-4 mr-2" />
                Drafts ({filteredExams.filter(e => e.status === "DRAFT").length})
              </TabsTrigger>
              <TabsTrigger value="published">
                <FileQuestion className="h-4 w-4 mr-2" />
                Published ({filteredExams.filter(e => e.status === "PUBLISHED").length})
              </TabsTrigger>
              <TabsTrigger value="closed">
                <Clock className="h-4 w-4 mr-2" />
                Closed ({filteredExams.filter(e => e.status === "CLOSED").length})
              </TabsTrigger>
            </TabsList>
            
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