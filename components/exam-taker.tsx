"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Clock, ThumbsUp, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { QuestionType } from "@prisma/client"

// Types for the component props
interface ExamTakerProps {
  formId: string
}

export default function ExamTaker({ formId }: ExamTakerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [exam, setExam] = useState<any>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState<any>({})
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [examResult, setExamResult] = useState<any>(null)
  const [alreadyCompletedError, setAlreadyCompletedError] = useState<string | null>(null)
  const [hasCompletionBadge, setHasCompletionBadge] = useState(false)
  const [showIterateDialog, setShowIterateDialog] = useState(false)
  const [iterating, setIterating] = useState(false)

  // Load saved state from localStorage when component mounts
  useEffect(() => {
    const loadSavedState = () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Load saved responses
        const savedResponses = localStorage.getItem(`exam_responses_${formId}`);
        if (savedResponses) {
          setResponses(JSON.parse(savedResponses));
        }
        
        // Load saved timer state
        const savedTimeLeft = localStorage.getItem(`exam_timeLeft_${formId}`);
        const savedStartTime = localStorage.getItem(`exam_startTime_${formId}`);
        
        if (savedTimeLeft && savedStartTime) {
          const parsedStartTime = new Date(savedStartTime);
          const parsedTimeLeft = parseInt(savedTimeLeft);
          
          // Calculate time elapsed since last save
          const now = new Date();
          const timeElapsedInSeconds = Math.floor((now.getTime() - parsedStartTime.getTime()) / 1000);
          
          // Update time left
          const updatedTimeLeft = Math.max(0, parsedTimeLeft - timeElapsedInSeconds);
          setTimeLeft(updatedTimeLeft);
          setStartTime(now);
        }
        
        // Load current question index
        const savedQuestionIndex = localStorage.getItem(`exam_questionIndex_${formId}`);
        if (savedQuestionIndex) {
          setCurrentQuestionIndex(parseInt(savedQuestionIndex));
        }
      } catch (error) {
        console.error("Error loading saved exam state:", error);
      }
    };
    
    loadSavedState();
  }, [formId]);

  // Save state to localStorage when it changes
  useEffect(() => {
    const saveState = () => {
      if (typeof window === 'undefined' || !exam || examCompleted) return;
      
      try {
        // Save responses
        localStorage.setItem(`exam_responses_${formId}`, JSON.stringify(responses));
        
        // Save time left
        if (timeLeft !== null) {
          localStorage.setItem(`exam_timeLeft_${formId}`, timeLeft.toString());
        }
        
        // Save start time
        if (startTime) {
          localStorage.setItem(`exam_startTime_${formId}`, startTime.toISOString());
        }
        
        // Save current question index
        localStorage.setItem(`exam_questionIndex_${formId}`, currentQuestionIndex.toString());
      } catch (error) {
        console.error("Error saving exam state:", error);
      }
    };
    
    saveState();
  }, [responses, timeLeft, startTime, currentQuestionIndex, formId, exam, examCompleted]);

  // Load the exam on component mount
  useEffect(() => {
    const fetchExam = async () => {
      try {
        setIsLoading(true)
        // First, check if the user is enrolled in the course containing this exam
        const enrollmentCheck = await fetch(`/api/exams/check-enrollment?formId=${formId}`)
        const enrollmentData = await enrollmentCheck.json()
        
        if (!enrollmentCheck.ok) {
          // User is not enrolled or not authorized
          toast({
            title: "Access Denied",
            description: enrollmentData.error || "You must be enrolled in this course to access this exam.",
            variant: "destructive",
          })
          // Redirect to dashboard after short delay
          setTimeout(() => {
            router.push("/dashboard/student")
          }, 2000)
          return
        }
        
        const response = await fetch(`/api/exams/submit?formId=${formId}`)
        const data = await response.json()

        if (response.ok) {
          setExam(data)
          
          // Check if this exam has a completion badge
          if (data.completionStatus) {
            setHasCompletionBadge(true)
            setExamResult(data.completionStatus)
          }
          
          // If this is the first load and we have a duration, set the timer
          if (!startTime && data.durationInMinutes) {
            const newStartTime = new Date()
            setStartTime(newStartTime)
            setTimeLeft(data.durationInMinutes * 60)
          }
        } else {
          // Handle the case where user has already completed the exam
          if (data.alreadyCompleted && data.completionStatus) {
            setExamCompleted(true)
            setHasCompletionBadge(true)
            setExamResult(data.completionStatus)
            
            // Check if the user can iterate on this exam
            if (data.canIterate) {
              setShowIterateDialog(true)
            } else {
              // Show a positive message for completed exam with no iteration option
              setAlreadyCompletedError("You've already completed this exam. Great job!")
            }
            
            // Clear any saved data for this exam since it's completed
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`exam_responses_${formId}`);
              localStorage.removeItem(`exam_timeLeft_${formId}`);
              localStorage.removeItem(`exam_startTime_${formId}`);
              localStorage.removeItem(`exam_questionIndex_${formId}`);
            }
          } else {
            toast({
              title: "Error loading exam",
              description: data.error || "Failed to load exam",
              variant: "destructive",
            })
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load exam",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchExam()
  }, [formId, startTime, router])

  // Timer for time-limited exams
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    
    if (timeLeft !== null && timeLeft > 0 && !examCompleted) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev !== null && prev <= 1) {
            // Time's up, auto-submit the exam
            clearInterval(timer as NodeJS.Timeout)
            handleSubmit()
            return 0
          }
          return prev !== null ? prev - 1 : null
        })
      }, 1000)
    }
    
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [timeLeft, examCompleted])

  // Format the time left into MM:SS
  const formatTimeLeft = () => {
    if (timeLeft === null) return "No time limit"
    
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Handle radio selection for multiple choice questions
  const handleRadioChange = (questionId: string, optionId: string) => {
    setResponses({
      ...responses,
      [questionId]: {
        questionId,
        selectedOptionIds: [optionId],
      },
    })
  }

  // Handle checkbox selection for multiple-answer questions
  const handleCheckboxChange = (questionId: string, optionId: string, checked: boolean) => {
    const currentSelectedOptions = responses[questionId]?.selectedOptionIds || []
    
    let newSelectedOptions
    if (checked) {
      newSelectedOptions = [...currentSelectedOptions, optionId]
    } else {
      newSelectedOptions = currentSelectedOptions.filter((id: string) => id !== optionId)
    }
    
    setResponses({
      ...responses,
      [questionId]: {
        questionId,
        selectedOptionIds: newSelectedOptions,
      },
    })
  }

  // Handle text input for short answer and paragraph questions
  const handleTextChange = (questionId: string, text: string) => {
    setResponses({
      ...responses,
      [questionId]: {
        questionId,
        textResponse: text,
      },
    })
  }

  // Navigate to the next question
  const goToNextQuestion = () => {
    if (currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      window.scrollTo(0, 0)
    }
  }

  // Navigate to the previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      window.scrollTo(0, 0)
    }
  }

  // Handle exam submission
  const handleSubmit = async () => {
    if (isSubmitting) return
    
    // Validation for required questions
    const unansweredRequiredQuestions = exam.questions
      .filter((q: any) => q.required)
      .filter((q: any) => {
        const response = responses[q.id]
        if (!response) return true
        
        if (q.type === "MULTIPLE_CHOICE" || q.type === "CHECKBOX") {
          return !response.selectedOptionIds || response.selectedOptionIds.length === 0
        } else {
          return !response.textResponse || response.textResponse.trim() === ""
        }
      })
    
    if (unansweredRequiredQuestions.length > 0) {
      // If there are unanswered required questions, show warning and navigate to the first one
      toast({
        title: "Required questions unanswered",
        description: "Please answer all required questions before submitting.",
        variant: "destructive",
      })
      
      // Navigate to the first unanswered required question
      const firstUnansweredIndex = exam.questions.findIndex(
        (q: any) => unansweredRequiredQuestions.some((uq: any) => uq.id === q.id)
      )
      
      if (firstUnansweredIndex !== -1) {
        setCurrentQuestionIndex(firstUnansweredIndex)
      }
      
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Flatten the responses object into an array
      const responsesArray = Object.values(responses)
      
      const response = await fetch("/api/exams/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          examId: exam.id,
          responses: responsesArray,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit exam")
      }
      
      const result = await response.json()
      
      setExamCompleted(true)
      setExamResult(result)
      
      // Clear localStorage data after successful submission
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`exam_responses_${formId}`);
        localStorage.removeItem(`exam_timeLeft_${formId}`);
        localStorage.removeItem(`exam_startTime_${formId}`);
        localStorage.removeItem(`exam_questionIndex_${formId}`);
      }
      
      toast({
        title: "Exam submitted successfully",
        description: result.requiresGrading
          ? "Your answers have been submitted. Results will be available after grading."
          : "Your answers have been submitted and graded.",
      })
    } catch (error: any) {
      toast({
        title: "Error submitting exam",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Function to reset the exam state for iteration
  const startNewIteration = () => {
    setIterating(true)
    setExamCompleted(false)
    setExamResult(null)
    setResponses({})
    setCurrentQuestionIndex(0)
    
    // Reset timer if exam has a time limit
    if (exam.durationInMinutes) {
      const newStartTime = new Date()
      setStartTime(newStartTime)
      setTimeLeft(exam.durationInMinutes * 60)
    }
    
    // Clear localStorage data for this exam
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`exam_responses_${formId}`)
      localStorage.removeItem(`exam_timeLeft_${formId}`)
      localStorage.removeItem(`exam_startTime_${formId}`)
      localStorage.removeItem(`exam_questionIndex_${formId}`)
    }
    
    setShowIterateDialog(false)
    setIterating(false)
    
    toast({
      title: "New attempt started",
      description: "You can now attempt the exam again.",
    })
    
    // Scroll to the top of the page
    window.scrollTo(0, 0)
  }

  // Function to handle the "Iterate" button click
  const handleIterateExam = () => {
    setShowIterateDialog(false)
    setExamCompleted(false)
    setIterating(true)
    setResponses({})
    setCurrentQuestionIndex(0)
    
    // Reset the form state for iteration
    if (exam && exam.questions) {
      const initialResponses = {};
      setResponses(initialResponses);
    }
    
    // If there's a time limit, reset the timer for the iteration
    if (exam?.durationInMinutes) {
      const newStartTime = new Date()
      setStartTime(newStartTime)
      setTimeLeft(exam.durationInMinutes * 60)
    }
    
    toast({
      title: "Exam Iteration Started",
      description: "You're now working on improving your previous submission.",
    })
  }
  
  // Function to dismiss the iterate dialog
  const dismissIterateDialog = () => {
    setShowIterateDialog(false)
  }

  // Function to display a completion badge if the exam has been completed
  const renderCompletionBadge = () => {
    if (!hasCompletionBadge || !examResult) return null;
    
    return (
      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        examResult.passed 
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      }`}>
        {examResult.passed ? 'Passed' : 'Attempted'}
      </span>
    );
  };

  // Calculate progress percentage
  const progress = exam?.questions 
    ? (Object.keys(responses).length / exam.questions.length) * 100 
    : 0;
    
  // Get current question
  const currentQuestion = exam?.questions?.[currentQuestionIndex] || {};

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Loading Exam...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-6 w-64 bg-muted rounded mb-4"></div>
            <div className="h-4 w-48 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Add the Dialog for exam iteration
  return (
    <>
      <Dialog open={showIterateDialog} onOpenChange={setShowIterateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue to iterate?</DialogTitle>
            <DialogDescription>
              You have already completed this exam. Would you like to attempt it again to improve your score?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {examResult && (
              <div className="space-y-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Previous Score</p>
                  <div className="flex items-center gap-3">
                    <Progress value={(examResult.score / examResult.maxScore) * 100} className="h-2" />
                    <span className="font-medium">{examResult.score} / {examResult.maxScore}</span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {examResult.passed ? 
                    "You've already passed this exam, but you can try again to improve your score." : 
                    "You didn't pass this exam yet. Retaking it will give you another chance."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={dismissIterateDialog}>
              No, View Results
            </Button>
            <Button onClick={handleIterateExam} className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Yes, Retake Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {alreadyCompletedError ? (
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="bg-green-50 dark:bg-green-900/20">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Exam Completed
            </CardTitle>
            <CardDescription>
              You have successfully completed this exam
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="border rounded-lg p-4 space-y-3 bg-green-50 dark:bg-green-900/10">
              <h4 className="font-medium flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                Completion Status
              </h4>
              {examResult && (
                <div className="space-y-4">
                  {examResult.score !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                      <div className="flex items-center gap-3">
                        <Progress value={(examResult.score / examResult.maxScore) * 100} className="h-2" />
                        <span className="font-medium">{examResult.score} / {examResult.maxScore}</span>
                      </div>
                    </div>
                  )}
                  
                  {examResult.passed !== null && (
                    <Alert className={examResult.passed ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"}>
                      {examResult.passed ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <AlertTitle>Passed</AlertTitle>
                          <AlertDescription>
                            Congratulations! You passed this exam on {new Date(examResult.completedAt).toLocaleDateString()}.
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <AlertTitle>Not Passed</AlertTitle>
                          <AlertDescription>
                            You attempted this exam on {new Date(examResult.completedAt).toLocaleDateString()} but did not achieve the passing score.
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      ) : examCompleted ? (
        <>
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Exam Completed
              </CardTitle>
              <CardDescription>
                Thank you for completing the exam.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">{exam.title}</h3>
                  {exam.description && <p className="text-muted-foreground">{exam.description}</p>}
                </div>
                
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-blue-500" />
                    Submission Summary
                  </h4>
                  
                  {examResult.score !== null ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                        <div className="flex items-center gap-3">
                          <Progress value={(examResult.score / examResult.maxScore) * 100} className="h-2" />
                          <span className="font-medium">{examResult.score} / {examResult.maxScore}</span>
                        </div>
                      </div>
                      
                      {examResult.passed !== null && (
                        <Alert className={examResult.passed ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}>
                          {examResult.passed ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <AlertTitle>Passed</AlertTitle>
                              <AlertDescription>
                                Congratulations! You have passed this exam.
                              </AlertDescription>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-red-500" />
                              <AlertTitle>Not Passed</AlertTitle>
                              <AlertDescription>
                                You have not achieved the passing score for this exam.
                              </AlertDescription>
                            </>
                          )}
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                      <AlertTitle>Manual Grading Required</AlertTitle>
                      <AlertDescription>
                        Your exam contains questions that require manual grading. Results will be available once grading is complete.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                  <Button 
                    onClick={() => router.push("/dashboard")}
                    variant="outline"
                  >
                    Return to Dashboard
                  </Button>
                  <Button 
                    onClick={() => setShowIterateDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Continue to iterate?
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Iterate dialog */}
          <Dialog open={showIterateDialog} onOpenChange={setShowIterateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a new attempt?</DialogTitle>
                <DialogDescription>
                  Would you like to attempt this exam again? Your previous attempt and score will still be recorded, but you'll get a fresh start.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowIterateDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={startNewIteration}
                  disabled={iterating}
                  className="flex items-center gap-2"
                >
                  {iterating ? "Starting..." : "Yes, start new attempt"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : !exam ? (
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Exam Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sorry, the exam you are looking for could not be found or is not available.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{exam.title} {renderCompletionBadge()}</CardTitle>
              <CardDescription>
                Question {currentQuestionIndex + 1} of {exam.questions.length}
              </CardDescription>
            </div>
            
            {timeLeft !== null && (
              <div className="flex items-center gap-2 bg-muted p-2 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{formatTimeLeft()}</span>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
            
            {/* Question */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <h3 className="text-lg font-medium">
                    {currentQuestion.text}
                  </h3>
                  {currentQuestion.required && (
                    <span className="text-red-500">*</span>
                  )}
                </div>
                {currentQuestion.required && (
                  <p className="text-sm text-muted-foreground">
                    This question is required
                  </p>
                )}
              </div>
              
              {/* Question type specific input */}
              {currentQuestion.type === "MULTIPLE_CHOICE" && (
                <RadioGroup
                  value={responses[currentQuestion.id]?.selectedOptionIds?.[0] || ""}
                  onValueChange={(value) => handleRadioChange(currentQuestion.id, value)}
                  className="space-y-3"
                >
                  {currentQuestion.options.map((option: any) => (
                    <div key={option.id} className="flex items-start space-x-2">
                      <RadioGroupItem id={option.id} value={option.id} />
                      <Label htmlFor={option.id} className="font-normal">{option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              
              {currentQuestion.type === "CHECKBOX" && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option: any) => (
                    <div key={option.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={(responses[currentQuestion.id]?.selectedOptionIds || []).includes(option.id)}
                        onCheckedChange={(checked) => handleCheckboxChange(currentQuestion.id, option.id, !!checked)}
                      />
                      <Label htmlFor={option.id} className="font-normal">{option.text}</Label>
                    </div>
                  ))}
                </div>
              )}
              
              {currentQuestion.type === "SHORT_ANSWER" && (
                <Input
                  placeholder="Your answer"
                  value={responses[currentQuestion.id]?.textResponse || ""}
                  onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                />
              )}
              
              {currentQuestion.type === "PARAGRAPH" && (
                <Textarea
                  placeholder="Your answer"
                  value={responses[currentQuestion.id]?.textResponse || ""}
                  onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                  rows={5}
                />
              )}
            </div>
            
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              
              {currentQuestionIndex < exam.questions.length - 1 ? (
                <Button onClick={goToNextQuestion}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Exam"}
                </Button>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center border-t pt-6 pb-4">
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full max-w-xs"
            >
              {isSubmitting ? "Submitting..." : "Save & Submit All Answers"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  )
}