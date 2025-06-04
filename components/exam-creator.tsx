"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Check, Loader2, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExamType, QuestionType } from "@prisma/client"

// Types for the component props
interface ExamCreatorProps {
  contentId?: string
  sectionId?: string
  lectureId?: string
  examTitle?: string
  examDescription?: string
  examType?: string
  passingScore?: number
  timeLimit?: number
  formId?: string
  onExamCreated?: (examId: string, formId: string, formUrl: string) => void
  requireCourse?: boolean
  courses?: { id: string; title: string }[]
  onCourseChange?: (courseId: string) => void
  defaultTab?: "details" | "questions" | "publish"
}

// Main component for creating and editing exams
export default function ExamCreator({
  contentId,
  sectionId,
  lectureId,
  examTitle,
  examDescription,
  examType,
  passingScore,
  timeLimit,
  formId,
  onExamCreated,
  requireCourse = false,
  courses = [],
  onCourseChange,
  defaultTab = "details",
}: ExamCreatorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [examId, setExamId] = useState<string | null>(null)
  const [formIdState, setFormId] = useState<string | null>(formId || null)
  const [questions, setQuestions] = useState<any[]>([])
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null)
  const [isExamPublished, setIsExamPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  // Reset state function to clear all state when needed
  const resetState = () => {
    setExamId(null)
    setFormId(null)
    setQuestions([])
    setActiveQuestionId(null)
    setIsExamPublished(false)
    setPublishedUrl(null)
    setActiveTab("details")
    
    // Reset the forms
    examForm.reset({
      title: "",
      description: "",
      instructions: "",
      type: "QUIZ" as ExamType,
      passingScore: 70,
      timeLimit: 30,
      startDate: "",
      endDate: "",
    })
    
    questionForm.reset({
      text: "",
      type: "MULTIPLE_CHOICE" as QuestionType,
      required: true,
      points: 1,
      negativeMarking: 0,
      options: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
    })
  }

  // Form for exam details
  const examForm = useForm({
    defaultValues: {
      title: examTitle || "",
      description: examDescription || "",
      instructions: "",
      type: (examType as ExamType) || "QUIZ" as ExamType,
      passingScore: passingScore || 70,
      timeLimit: timeLimit || 30,
      startDate: "",
      endDate: "",
    },
  })

  // Form for creating questions
  const questionForm = useForm({
    defaultValues: {
      text: "",
      type: "MULTIPLE_CHOICE" as QuestionType,
      required: true,
      points: 1,
      negativeMarking: 0,
      options: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
    },
  })

  // Add a new option to the question
  const addOption = () => {
    const options = questionForm.getValues("options") || []
    questionForm.setValue("options", [...options, { text: "", isCorrect: false }])
  }

  // Remove an option from the question
  const removeOption = (index: number) => {
    const options = questionForm.getValues("options") || []
    questionForm.setValue(
      "options",
      options.filter((_, i) => i !== index)
    )
  }

  // Toggle whether an option is correct
  const toggleOptionCorrect = (index: number) => {
    const options = questionForm.getValues("options") || []
    const newOptions = [...options]
    
    // For multiple choice, only one option can be correct
    if (questionForm.getValues("type") === "MULTIPLE_CHOICE") {
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === index
      })
    } else {
      // For checkbox, multiple options can be correct
      newOptions[index].isCorrect = !newOptions[index].isCorrect
    }
    
    questionForm.setValue("options", newOptions)
  }

  // Create a new exam
  const createExam = async (data: any) => {
    setIsLoading(true)
    
    try {
      // If course selection is required but not provided, show an error
      if (requireCourse && !contentId) {
        toast({
          title: "Course required",
          description: "Please select a course for this exam.",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }
      
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          title: data.title,
          description: data.description,
          instructions: data.instructions,
          type: data.type,
          passingScore: data.passingScore,
          timeLimit: data.timeLimit,
          startDate: data.startDate ? preserveTimezoneForDB(data.startDate) : undefined,
          endDate: data.endDate ? preserveTimezoneForDB(data.endDate) : undefined,
          contentId,
          sectionId,
          lectureId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create exam")
      }

      const result = await response.json()
      
      // Pass the created exam details back to the parent component
      if (onExamCreated) {
        onExamCreated(result.examId, result.formId, result.formUrl)
      }
      
      // Set the exam ID and form ID regardless of whether a callback was provided
      setExamId(result.examId)
      setFormId(result.formId)
      
      toast({
        title: "Exam created successfully",
        description: "Now you can add questions to your exam.",
      })
      
      // Immediately navigate to questions tab after creating an exam
      setActiveTab("questions")
    } catch (error: any) {
      toast({
        title: "Error creating exam",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Add a question to the exam
  const addQuestion = async (data: any) => {
    if (!examId) return
    
    setIsLoading(true)
    
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addQuestion",
          examId,
          question: {
            text: data.text,
            type: data.type,
            required: data.required,
            points: data.points,
            negativeMarking: data.negativeMarking,
            options: data.type === "MULTIPLE_CHOICE" || data.type === "CHECKBOX" ? data.options : undefined,
            order: questions.length, // Add to the end of the list
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add question")
      }

      const result = await response.json()
      
      // Add the new question to the list
      setQuestions([
        ...questions,
        {
          id: result.questionId,
          text: data.text,
          type: data.type,
          required: data.required,
          points: data.points,
          negativeMarking: data.negativeMarking,
          options: data.type === "MULTIPLE_CHOICE" || data.type === "CHECKBOX" ? data.options : undefined,
        },
      ])
      
      // Reset the form for the next question
      questionForm.reset({
        text: "",
        type: "MULTIPLE_CHOICE",
        required: true,
        points: 1,
        negativeMarking: 0,
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      })
      
      toast({
        title: "Question added successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error adding question",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a question from the exam
  const deleteQuestion = async (questionId: string) => {
    setIsLoading(true)
    
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteQuestion",
          questionId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete question")
      }

      // Remove the question from the list
      setQuestions(questions.filter(q => q.id !== questionId))
      
      toast({
        title: "Question deleted successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error deleting question",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Publish the exam
  const publishExam = async () => {
    if (!examId) return
    
    setIsLoading(true)
    
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "publish",
          examId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to publish exam")
      }

      const result = await response.json()
      setIsExamPublished(true)
      setPublishedUrl(result.publishedUrl)
      
      toast({
        title: "Exam published successfully",
        description: "Students can now take the exam.",
      })
      
      // Switch to the publish tab
      setActiveTab("publish")
    } catch (error: any) {
      toast({
        title: "Error publishing exam",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Function to preserve timezone info when storing in the database
  const preserveTimezoneForDB = (dateString: string): string => {
    try {
      // Parse the date input, which is in local time
      const localDate = new Date(dateString);
      
      // Create a date string that preserves the exact local date and time
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, "0");
      const day = String(localDate.getDate()).padStart(2, "0");
      const hours = String(localDate.getHours()).padStart(2, "0");
      const minutes = String(localDate.getMinutes()).padStart(2, "0");
      const seconds = String(localDate.getSeconds()).padStart(2, "0");
      
      // Format: YYYY-MM-DDTHH:MM:SS.sssZ with UTC offset
      const tzOffset = -localDate.getTimezoneOffset();
      const tzOffsetHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
      const tzOffsetMinutes = String(Math.abs(tzOffset) % 60).padStart(2, "0");
      const tzSign = tzOffset >= 0 ? "+" : "-";
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzOffsetHours}:${tzOffsetMinutes}`;
    } catch (error) {
      console.error("Error preserving timezone for DB:", error);
      return new Date().toISOString(); // Fallback to current time
    }
  }
  
  // Update date loading functions
  const formatDateTimeForInput = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
      // Format to YYYY-MM-DDTHH:MM format required for datetime-local input
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error("Error formatting date for input:", error);
      return '';
    }
  }

  // Ensure Questions tab is selected after exam creation
  useEffect(() => {
    if (examId && !formIdState) {
      // This specifically targets the initial creation flow
      // formIdState would be null when creating a new exam
      setActiveTab("questions");
    }
  }, [examId, formIdState]);

  // Load the exam if examId is provided
  useEffect(() => {
    if (examId) {
      const loadExam = async () => {
        try {
          const response = await fetch(`/api/exams?examId=${examId}`)
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Failed to load exam")
          }
          
          const exam = await response.json()
          
          // Set the form values
          examForm.reset({
            title: exam.title,
            description: exam.description || "",
            instructions: exam.instructions || "",
            type: exam.type,
            passingScore: exam.passingScore || 70,
            timeLimit: exam.timeLimit || 30,
            startDate: formatDateTimeForInput(exam.startDate),
            endDate: formatDateTimeForInput(exam.endDate),
          })
          
          // Set the questions
          if (exam.questions) {
            setQuestions(exam.questions)
          }
          
          // Check if the exam is published
          setIsExamPublished(exam.status === "PUBLISHED" || exam.status === "CLOSED")
          
          if (exam.status === "PUBLISHED" || exam.status === "CLOSED") {
            setPublishedUrl(`/exams/${exam.formId}/take`)
          }
        } catch (error: any) {
          toast({
            title: "Error loading exam",
            description: error.message,
            variant: "destructive",
          })
        }
      }
      
      loadExam()
    }
  }, [examId])

  // Load exam data when formId is provided directly
  useEffect(() => {
    if (formIdState && !examId) {
      const loadExamByFormId = async () => {
        setIsLoading(true)
        try {
          const response = await fetch(`/api/exams?formId=${formIdState}`)
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Failed to load exam")
          }
          
          const exam = await response.json()
          
          // Set the exam ID so we don't reload unnecessarily
          setExamId(exam.id)
          
          // Set the form values
          examForm.reset({
            title: exam.title,
            description: exam.description || "",
            instructions: exam.instructions || "",
            type: exam.type,
            passingScore: exam.passingScore || 70,
            timeLimit: exam.timeLimit || 30,
            startDate: formatDateTimeForInput(exam.startDate),
            endDate: formatDateTimeForInput(exam.endDate),
          })
          
          // Set the questions
          if (exam.questions) {
            setQuestions(exam.questions)
          }
          
          // Check if the exam is published
          setIsExamPublished(exam.status === "PUBLISHED" || exam.status === "CLOSED")
          
          if (exam.status === "PUBLISHED" || exam.status === "CLOSED") {
            setPublishedUrl(`/exams/${exam.formId}/take`)
          }
          
          // Only set the tab to 'questions' if it hasn't been set already
          // This allows our immediate tab switch after creation to take precedence
          if (exam.questions && exam.questions.length > 0 && activeTab === "details") {
            setActiveTab("questions")
          }
        } catch (error: any) {
          toast({
            title: "Error loading exam",
            description: error.message,
            variant: "destructive",
          })
        } finally {
          setIsLoading(false)
        }
      }
      
      loadExamByFormId()
    }
  }, [formIdState])

  return (
    <Card className="w-full max-w-4xl mx-auto border-indigo-100 dark:border-indigo-900/30 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-900/30">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 text-transparent bg-clip-text">Exam Creator</CardTitle>
        <CardDescription className="text-indigo-600/70 dark:text-indigo-300/70">
          Create custom quizzes and assessments for your students
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "questions" | "publish")} defaultValue={defaultTab}>
          <TabsList className="mb-6 bg-indigo-50/70 dark:bg-indigo-950/30 p-1 rounded-lg">
            <TabsTrigger 
              value="details" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-800/40 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Exam Details
            </TabsTrigger>
            <TabsTrigger 
              value="questions" 
              disabled={!examId}
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-800/40 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Questions ({questions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="publish" 
              disabled={!examId || questions.length === 0}
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-800/40 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Publish
            </TabsTrigger>
          </TabsList>
          
          {/* Exam Details Tab */}
          <TabsContent value="details">
            <Form {...examForm}>
              <form onSubmit={examForm.handleSubmit(createExam)}>
                <div className="space-y-6">
                  {requireCourse && courses && courses.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/30 dark:to-purple-950/30 p-5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 mb-4 shadow-sm">
                      <h3 className="text-lg font-medium text-indigo-800 dark:text-indigo-300 mb-3">Course Assignment</h3>
                      <FormItem className="mb-0">
                        <FormLabel className="text-indigo-700 dark:text-indigo-300">
                          Select Course <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          value={contentId || ""}
                          onValueChange={(value) => {
                            if (onCourseChange) {
                              onCourseChange(value);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="border-indigo-200 ring-indigo-100 dark:border-indigo-800/40 focus:ring-2 focus:ring-indigo-500/20">
                              <SelectValue placeholder="Select a course" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-indigo-100 dark:border-indigo-900/40">
                            {courses.length === 0 ? (
                              <SelectItem value="none" disabled>No courses available</SelectItem>
                            ) : (
                              courses.map(course => (
                                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-indigo-600/60 dark:text-indigo-400/60 mt-2">
                          Students enrolled in this course will have access to the exam.
                        </FormDescription>
                        {!contentId && (
                          <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80 mt-2 italic flex items-center">
                            <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                            Required for exams to be visible to enrolled students
                          </p>
                        )}
                      </FormItem>
                    </div>
                  )}
                  
                  <div className="bg-white dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-indigo-800 dark:text-indigo-300 mb-4">Exam Details</h3>
                  
                    <FormField
                      control={examForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exam Title <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Enter exam title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  
                  <FormField
                    control={examForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter exam description" {...field} />
                        </FormControl>
                        <FormDescription>
                          A brief description of what this exam covers.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={examForm.control}
                    name="instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instructions</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter exam instructions" {...field} />
                        </FormControl>
                        <FormDescription>
                          Instructions for students taking the exam.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={examForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exam Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select exam type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="QUIZ">Quiz</SelectItem>
                              <SelectItem value="MCQ">Multiple Choice</SelectItem>
                              <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                              <SelectItem value="FINAL">Final Exam</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The type of assessment.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={examForm.control}
                      name="passingScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passing Score (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="70"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || '')}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum percentage to pass the exam.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={examForm.control}
                      name="timeLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Limit (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="30"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || '')}
                            />
                          </FormControl>
                          <FormDescription>
                            Time allowed for completion. Leave empty for no limit.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={examForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date & Time (Optional)</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormDescription>
                            When the exam becomes available.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={examForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date & Time (Optional)</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormDescription>
                            When the exam closes.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isLoading || !!examId}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <span className="mr-2">Creating...</span>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </>
                    ) : examId ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Exam Created
                      </>
                    ) : (
                      "Create Exam"
                    )}
                  </Button>
                  </div>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          {/* Questions Tab */}
          <TabsContent value="questions">
            {examId ? (
              <div className="space-y-8">
                {/* Existing Questions */}
                {questions.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-indigo-800 dark:text-indigo-300">Existing Questions</h3>
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 text-sm rounded-full font-medium">
                        {questions.length} Question{questions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Accordion 
                      type="multiple" 
                      defaultValue={[]} 
                      className="border border-indigo-100 dark:border-indigo-900/30 rounded-lg overflow-hidden bg-white dark:bg-slate-900/60 shadow-sm"
                    >
                      {questions.map((question, index) => (
                        <AccordionItem key={question.id} value={question.id} className="border-indigo-100 dark:border-indigo-900/30 px-1">
                          <AccordionTrigger className="text-left py-4 px-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                                {index + 1}
                              </div>
                              <span className="font-medium text-indigo-700 dark:text-indigo-300">{question.text.substring(0, 60)}{question.text.length > 60 ? '...' : ''}</span>
                              <span className="ml-auto text-sm text-indigo-500/70 dark:text-indigo-400/70 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                                {question.type.replace('_', ' ')} ({question.points} pt{question.points !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-5 p-5 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-lg">
                              <div>
                                <h4 className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Question Text</h4>
                                <p className="bg-white dark:bg-slate-900/60 p-3 rounded border border-indigo-100 dark:border-indigo-900/30">{question.text}</p>
                              </div>
                              
                              {(question.type === "MULTIPLE_CHOICE" || question.type === "CHECKBOX") && question.options && (
                                <div>
                                  <h4 className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Options</h4>
                                  <ul className="space-y-2 mt-2 bg-white dark:bg-slate-900/60 p-3 rounded border border-indigo-100 dark:border-indigo-900/30">
                                    {question.options.map((option: any, i: number) => (
                                      <li key={i} className={`flex items-center gap-2 p-2 rounded ${option.isCorrect ? 'bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30' : ''}`}>
                                        {option.isCorrect ? (
                                          <div className="flex-shrink-0 h-5 w-5 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center">
                                            <Check className="h-3 w-3 text-white" />
                                          </div>
                                        ) : (
                                          <div className="flex-shrink-0 h-5 w-5 rounded-full border border-gray-300 dark:border-gray-700"></div>
                                        )}
                                        <span className={option.isCorrect ? 'text-green-700 dark:text-green-400 font-medium' : ''}>{option.text}</span>
                                        {option.isCorrect && (
                                          <span className="ml-auto text-sm text-green-600 dark:text-green-400 font-medium">Correct</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              <div className="flex justify-end">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteQuestion(question.id)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
                
                {/* Add New Question */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-medium">Add New Question</h3>
                  <Form {...questionForm}>
                    <form onSubmit={questionForm.handleSubmit(addQuestion)} className="space-y-4">
                      <FormField
                        control={questionForm.control}
                        name="text"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Question Text *</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Enter your question" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={questionForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Question Type</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value)
                                  // Reset options if changing to a text question
                                  if (value === "SHORT_ANSWER" || value === "PARAGRAPH") {
                                    questionForm.setValue("options", [])
                                  } else if (!questionForm.getValues("options") || questionForm.getValues("options").length === 0) {
                                    // Add default options if changing to a choice question
                                    questionForm.setValue("options", [
                                      { text: "", isCorrect: false },
                                      { text: "", isCorrect: false },
                                    ])
                                  }
                                }}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select question type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="MULTIPLE_CHOICE">Multiple Choice (Single Answer)</SelectItem>
                                  <SelectItem value="CHECKBOX">Multiple Choice (Multiple Answers)</SelectItem>
                                  <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                                  <SelectItem value="PARAGRAPH">Paragraph</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={questionForm.control}
                          name="points"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Points</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={questionForm.control}
                          name="required"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Required</FormLabel>
                                <FormDescription>
                                  Is this question required?
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={questionForm.control}
                          name="negativeMarking"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Negative Marking</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Points deducted for wrong answers (0 for none).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Options for Multiple Choice or Checkbox questions */}
                      {(questionForm.watch("type") === "MULTIPLE_CHOICE" || questionForm.watch("type") === "CHECKBOX") && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Options</h4>
                            <Button type="button" variant="outline" size="sm" onClick={addOption}>
                              <Plus className="h-4 w-4 mr-1" /> Add Option
                            </Button>
                          </div>
                          
                          {questionForm.watch("options") && questionForm.watch("options").map((option, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Checkbox
                                id={`option-correct-${index}`}
                                checked={option.isCorrect}
                                onCheckedChange={() => toggleOptionCorrect(index)}
                              />
                              <div className="flex-1">
                                <Input
                                  placeholder={`Option ${index + 1}`}
                                  value={option.text}
                                  onChange={(e) => {
                                    const options = questionForm.getValues("options")
                                    options[index].text = e.target.value
                                    questionForm.setValue("options", options)
                                  }}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(index)}
                                disabled={questionForm.watch("options").length <= 2}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          
                          {questionForm.watch("type") === "MULTIPLE_CHOICE" && (
                            <FormDescription>
                              Check the box next to the correct answer (only one).
                            </FormDescription>
                          )}
                          
                          {questionForm.watch("type") === "CHECKBOX" && (
                            <FormDescription>
                              Check the boxes next to all correct answers (can be multiple).
                            </FormDescription>
                          )}
                        </div>
                      )}
                      
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? "Adding..." : "Add Question"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Create exam first</AlertTitle>
                <AlertDescription>
                  You need to create the exam before adding questions.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          {/* Publish Tab */}
          <TabsContent value="publish">
            {examId && questions.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium">Exam Summary</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    You've created an exam with {questions.length} question{questions.length !== 1 ? 's' : ''}.
                  </p>
                </div>
                
                {isExamPublished ? (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <Check className="h-4 w-4 text-green-500" />
                      <AlertTitle>Exam Published</AlertTitle>
                      <AlertDescription>
                        Your exam is now available for students to take.
                      </AlertDescription>
                    </Alert>
                    
                    {publishedUrl && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium">Exam Link</h4>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="bg-muted p-2 rounded text-sm flex-1 overflow-auto">
                            {window.location.origin}{publishedUrl}
                          </code>
                          <Button
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}${publishedUrl}`)
                              toast({
                                title: "Link copied to clipboard",
                              })
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Separator />
                    
                    <div className="flex justify-center">
                      <Button
                        onClick={publishExam}
                        disabled={isLoading || questions.length === 0}
                        className="w-full max-w-xs"
                      >
                        {isLoading ? "Publishing..." : "Publish Exam"}
                      </Button>
                    </div>
                    
                    <div className="text-center text-sm text-muted-foreground mt-2">
                      Once published, the exam will be available to students.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Add questions first</AlertTitle>
                <AlertDescription>
                  You need to add at least one question before publishing the exam.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}