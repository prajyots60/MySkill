"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle, Clock, Eye, File, FilePen, LinkIcon, Loader2, MailQuestion, Send, Settings, User } from "lucide-react"
import { QuestionEditor } from "@/components/question-editor"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/utils/format"
import ExamResults from "@/components/exam-results"

interface ExamDetailsPageProps {
  params: {
    examId: string
  }
}

interface Question {
  id: string
  text: string
  type: string
  required: boolean
  order: number
  points: number
  negativeMarking?: number | null
  options?: {
    id: string
    text: string
    isCorrect: boolean
    order: number
  }[]
}

interface Exam {
  id: string
  title: string
  description?: string
  instructions?: string
  type: string
  status: string
  passingScore?: number
  timeLimit?: number
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
  formId: string
  formUrl?: string
  creatorId: string
  contentId?: string
  sectionId?: string
  lectureId?: string
}

export default function ExamDetailsPage({ params }: ExamDetailsPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const unwrappedParams = React.use(params)
  const examId = unwrappedParams.examId
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState("edit")
  const [responses, setResponses] = useState([])
  const [isLoadingResponses, setIsLoadingResponses] = useState(false)

  // Fetch exam details
  useEffect(() => {
    const fetchExam = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/exams/${examId}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch exam")
        }
        
        const data = await response.json()
        setExam(data.exam)
        setQuestions(data.questions || [])
      } catch (error) {
        console.error("Error fetching exam:", error)
        toast({
          title: "Error",
          description: "Failed to load exam details",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchExam()
  }, [examId, toast])

  // Refresh questions list
  const refreshQuestions = async () => {
    try {
      const response = await fetch(`/api/exams/${examId}/questions`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch questions")
      }
      
      const data = await response.json()
      setQuestions(data.questions || [])
    } catch (error) {
      console.error("Error fetching questions:", error)
    }
  }

  // Publish the exam
  const handlePublishExam = async () => {
    if (!exam) return
    
    try {
      setIsPublishing(true)
      const response = await fetch(`/api/exams/${examId}/publish`, {
        method: "POST",
      })
      
      if (!response.ok) {
        throw new Error("Failed to publish exam")
      }
      
      const data = await response.json()
      setExam({
        ...exam,
        status: "PUBLISHED",
        formUrl: data.shareableUrl || '',
      })
      
      toast({
        title: "Success",
        description: "Exam published successfully",
      })
    } catch (error) {
      console.error("Error publishing exam:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish exam",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  // Close the exam
  const handleCloseExam = async () => {
    if (!exam) return
    
    try {
      setIsClosing(true)
      const response = await fetch(`/api/exams/${examId}/close`, {
        method: "POST",
      })
      
      if (!response.ok) {
        throw new Error("Failed to close exam")
      }
      
      const data = await response.json()
      setExam({
        ...exam,
        status: "CLOSED",
      })
      
      toast({
        title: "Success",
        description: "Exam closed successfully",
      })
    } catch (error) {
      console.error("Error closing exam:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close exam",
        variant: "destructive",
      })
    } finally {
      setIsClosing(false)
    }
  }

  // Generate shareable link for the exam
  const getExamShareableLink = () => {
    if (!exam?.formId) return '';
    return `${window.location.origin}/exams/${exam.formId}/take`;
  }

  // Generate results link for the exam
  const getExamResultsLink = () => {
    if (!exam?.formId) return '';
    return `${window.location.origin}/exams/${exam.formId}/results`;
  }

  // Copy link to clipboard
  const copyLinkToClipboard = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied",
      description: "Exam link copied to clipboard",
    });
  }

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="container py-10">
        <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h3 className="font-medium text-destructive">Exam not found</h3>
            <p className="text-sm text-muted-foreground">The requested exam could not be found or you don't have permission to view it.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.push("/dashboard/creator/exams")}
            >
              Back to Exams
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{exam.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={exam.status === "DRAFT" ? "secondary" : exam.status === "PUBLISHED" ? "success" : "destructive"}>
              {exam.status}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Created: {formatDate(new Date(exam.createdAt))}
            </p>
            {exam.passingScore && (
              <Badge variant="outline">
                Passing Score: {exam.passingScore}%
              </Badge>
            )}
            {exam.timeLimit && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {exam.timeLimit} minutes
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex mt-4 md:mt-0 gap-2">
          {exam.status === "DRAFT" && (
            <Button onClick={handlePublishExam} disabled={isPublishing || questions.length === 0}>
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publish Exam
            </Button>
          )}
          
          {exam.status === "PUBLISHED" && (
            <>
              <Button variant="outline" onClick={() => copyLinkToClipboard(getExamShareableLink())}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Copy Exam Link
              </Button>
              
              <Button variant="outline" asChild>
                <Link href={getExamResultsLink()} target="_blank">
                  <Eye className="mr-2 h-4 w-4" />
                  View Results
                </Link>
              </Button>
              
              <Button variant="destructive" onClick={handleCloseExam} disabled={isClosing}>
                {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Close Exam
              </Button>
            </>
          )}
          
          {exam.status === "CLOSED" && (
            <Button variant="outline" asChild>
              <Link href={getExamResultsLink()} target="_blank">
                <Eye className="mr-2 h-4 w-4" />
                View Results
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      {questions.length === 0 && exam.status === "DRAFT" && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 mb-6">
          <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            No Questions Added
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            You need to add at least one question before you can publish this exam.
          </p>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="edit" disabled={exam.status === "CLOSED"}>
            <FilePen className="h-4 w-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="questions">
            <MailQuestion className="h-4 w-4 mr-2" />
            Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="responses" disabled={exam.status === "DRAFT"}>
            <User className="h-4 w-4 mr-2" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="edit" className="space-y-4">
          {exam.status === "DRAFT" ? (
            <QuestionEditor examId={examId} onQuestionCreated={refreshQuestions} />
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Exam Locked
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                This exam has been published and cannot be edited. You can view the questions and responses.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {questions.length === 0
                  ? "No questions have been added to this exam yet."
                  : `This exam contains ${questions.length} question${questions.length === 1 ? "" : "s"}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MailQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No questions added</p>
                  {exam.status === "DRAFT" && (
                    <p className="text-sm mt-1">Use the Edit tab to add questions to your exam.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center rounded-full bg-muted w-6 h-6 mt-1 text-xs font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="font-medium">{question.text}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {question.type === "MULTIPLE_CHOICE"
                                  ? "Multiple Choice (Single)"
                                  : question.type === "CHECKBOX"
                                  ? "Multiple Choice (Multiple)"
                                  : question.type === "SHORT_ANSWER"
                                  ? "Short Answer"
                                  : "Paragraph"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {question.points} point{question.points !== 1 ? "s" : ""}
                              </Badge>
                              {question.required && (
                                <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {(question.type === "MULTIPLE_CHOICE" || question.type === "CHECKBOX") && question.options && (
                        <div className="mt-3 pl-9">
                          <p className="text-xs text-muted-foreground mb-2">Options:</p>
                          <div className="space-y-1">
                            {question.options.map((option) => (
                              <div key={option.id} className="flex items-center gap-2">
                                <div className="w-4 h-4 flex items-center justify-center">
                                  {question.type === "MULTIPLE_CHOICE" ? (
                                    <div className={`w-3 h-3 rounded-full border ${option.isCorrect ? "bg-green-500 border-green-600" : "border-gray-300"}`} />
                                  ) : (
                                    <div className={`w-3 h-3 rounded-sm border ${option.isCorrect ? "bg-green-500 border-green-600" : "border-gray-300"}`} />
                                  )}
                                </div>
                                <span className={option.isCorrect ? "font-medium text-green-700" : ""}>
                                  {option.text}
                                </span>
                                {option.isCorrect && (
                                  <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                    Correct
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(question.type === "SHORT_ANSWER" || question.type === "PARAGRAPH") && (
                        <div className="mt-3 pl-9">
                          <div className={`border rounded-md p-2 ${question.type === "SHORT_ANSWER" ? "h-8" : "h-20"} bg-slate-50 dark:bg-slate-900/30`}>
                            <p className="text-xs text-muted-foreground italic">
                              {question.type === "SHORT_ANSWER"
                                ? "Short text answer"
                                : "Paragraph answer"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="responses">
          {exam.status === "DRAFT" ? (
            <Card>
              <CardHeader>
                <CardTitle>Student Responses</CardTitle>
                <CardDescription>
                  View and manage student submissions for this exam
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p>This exam has not been published yet. No responses are available.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ExamResults examId={examId} />
          )}
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Exam Settings</CardTitle>
              <CardDescription>
                Configure and manage exam settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Exam Information</h3>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground block">Title</span>
                        <span className="font-medium">{exam.title}</span>
                      </div>
                      {exam.description && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Description</span>
                          <span>{exam.description}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-muted-foreground block">Type</span>
                        <span>{exam.type}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Status</span>
                        <Badge variant={exam.status === "DRAFT" ? "secondary" : exam.status === "PUBLISHED" ? "success" : "destructive"}>
                          {exam.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Exam Rules</h3>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground block">Passing Score</span>
                        <span>{exam.passingScore ? `${exam.passingScore}%` : "Not set"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Time Limit</span>
                        <span>{exam.timeLimit ? `${exam.timeLimit} minutes` : "No time limit"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Total Questions</span>
                        <span>{questions.length}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Total Points</span>
                        <span>{questions.reduce((total, q) => total + q.points, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Exam Links</h3>
                  <div className="bg-muted rounded-lg p-4 space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground block">Exam Link for Students</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-muted-foreground/20 px-2 py-1 rounded text-xs flex-1 truncate">
                          {getExamShareableLink()}
                        </code>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyLinkToClipboard(getExamShareableLink())}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-xs text-muted-foreground block">Results Page</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-muted-foreground/20 px-2 py-1 rounded text-xs flex-1 truncate">
                          {getExamResultsLink()}
                        </code>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyLinkToClipboard(getExamResultsLink())}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {exam.status !== "CLOSED" && (
                  <>
                    <Separator />
                    
                    <div>
                      <h3 className="text-sm font-medium mb-2 text-destructive">Danger Zone</h3>
                      <div className="bg-destructive/10 rounded-lg p-4">
                        {exam.status === "DRAFT" ? (
                          <Button variant="destructive" className="w-full sm:w-auto">
                            Delete Exam
                          </Button>
                        ) : (
                          <Button variant="destructive" className="w-full sm:w-auto" onClick={handleCloseExam} disabled={isClosing}>
                            {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Close Exam
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}