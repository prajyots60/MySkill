"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [localStorageTimerId, setLocalStorageTimerId] = useState<NodeJS.Timeout | null>(null)
  const [warningMessage, setWarningMessage] = useState<string>("")

  const timeLeftRef = useRef(timeLeft)
  const examCompletedRef = useRef(examCompleted)
  const endTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])
  useEffect(() => {
    examCompletedRef.current = examCompleted
  }, [examCompleted])

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
        
        // Load saved timer state with improved accuracy
        const savedExamEndTime = localStorage.getItem(`exam_endTime_${formId}`);
        
        if (savedExamEndTime) {
          const parsedExamEndTime = new Date(savedExamEndTime);
          const now = new Date();
          
          // Set the end time ref for future calculations
          endTimeRef.current = parsedExamEndTime;
          
          // Calculate time remaining based on the end time
          const remainingTimeInSeconds = Math.max(0, Math.floor((parsedExamEndTime.getTime() - now.getTime()) / 1000));
          console.log("Loaded persistent timer - remaining time:", remainingTimeInSeconds, "seconds");
          
          // If there's still time left, set it
          if (remainingTimeInSeconds > 0) {
            setTimeLeft(remainingTimeInSeconds);
            setStartTime(new Date(parsedExamEndTime.getTime() - (exam?.timeLimit || 0) * 60 * 1000));
          } else if (remainingTimeInSeconds <= 0) {
            // Time has expired while away, trigger auto-submission
            setTimeLeft(0);
            setTimeout(() => {
              if (!examCompletedRef.current) {
                handleSubmit();
              }
            }, 1000);
          }
        }
        
        // Load current question index
        const savedQuestionIndex = localStorage.getItem(`exam_questionIndex_${formId}`);
        if (savedQuestionIndex) {
          setCurrentQuestionIndex(parseInt(savedQuestionIndex));
        }
        
        // Load tab change count
        const savedTabChangeCount = localStorage.getItem(`exam_tabChangeCount_${formId}`);
        if (savedTabChangeCount) {
          setTabChangeCount(parseInt(savedTabChangeCount));
        }
      } catch (error) {
        console.error("Error loading saved exam state:", error);
      }
    };
    
    loadSavedState();
    
    // Set up tab change detection
    const handleVisibilityChange = () => {
      if (!examCompletedRef.current && timeLeftRef.current !== null) {
        if (document.visibilityState === 'hidden') {
          // When tab is hidden, just update the tab change count
          setTabChangeCount(prevCount => {
            const newCount = prevCount + 1;
            localStorage.setItem(`exam_tabChangeCount_${formId}`, newCount.toString());
            if (newCount >= 3) {
              setTimeout(() => {
                if (!examCompletedRef.current) {
                  handleSubmit();
                }
              }, 1000);
            }
            return newCount;
          });
        } else if (document.visibilityState === 'visible') {
          // When tab becomes visible again, recalculate the time left from the end time
          const storedEndTime = localStorage.getItem(`exam_endTime_${formId}`);
          if (storedEndTime) {
            const parsedEndTime = new Date(storedEndTime);
            const now = new Date();
            const newTimeLeft = Math.max(0, Math.floor((parsedEndTime.getTime() - now.getTime()) / 1000));
            
            // Update the time left state with the accurate value
            setTimeLeft(newTimeLeft);
            console.log("Tab visible: Recalculated time left:", newTimeLeft);
            
            // If time expired while away, trigger submission
            if (newTimeLeft <= 0 && !examCompletedRef.current) {
              setTimeout(() => handleSubmit(), 1000);
            }
          }
          
          // Also update tab change count from localStorage for consistency
          const storedTabChangeCount = localStorage.getItem(`exam_tabChangeCount_${formId}`);
          const currentCount = storedTabChangeCount ? parseInt(storedTabChangeCount) : tabChangeCount;
          if (currentCount > 0) {
            setTabChangeCount(currentCount);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [formId]);

  // Show toast when tabChangeCount changes
  useEffect(() => {
    if (tabChangeCount > 0) {
      let message = "";
      if (tabChangeCount === 1) {
        message = "First warning: Please stay on the exam page.";
      } else if (tabChangeCount === 2) {
        message = "Second warning: This is your last chance. Next tab change will auto-submit your exam.";
      } else if (tabChangeCount >= 3) {
        message = "Final warning: Your exam will be auto-submitted due to multiple tab changes.";
      }
      if (message) {
        toast({
          title: "Tab Change Detected!",
          description: `${message} Tab changes remaining: ${Math.max(0, 3 - tabChangeCount)}`,
          variant: tabChangeCount >= 3 ? "destructive" : "default",
          duration: 7000,
        });
      }
    }
  }, [tabChangeCount]);

  // Timer effect
  useEffect(() => {
    if (!exam || !startTime || examCompleted) return;

    // Make sure we have an end time reference
    if (!endTimeRef.current && startTime && exam.timeLimit) {
      const durationInSeconds = exam.timeLimit * 60;
      endTimeRef.current = new Date(startTime.getTime() + durationInSeconds * 1000);
      console.log("Setting end time reference:", endTimeRef.current.toISOString());
    }

    const timer = setInterval(() => {
      // Calculate based on the absolute end time for accuracy
      if (endTimeRef.current) {
        const now = new Date();
        const newTimeLeft = Math.max(0, Math.floor((endTimeRef.current.getTime() - now.getTime()) / 1000));
        
        setTimeLeft(prevTime => {
          // If time's up, clear interval and submit
          if (newTimeLeft <= 0) {
            clearInterval(timer);
            if (!examCompleted) {
              handleSubmit();
            }
            return 0;
          }
          return newTimeLeft;
        });
      } else {
        // Fallback to the old countdown method if no end time is available
        setTimeLeft(prevTime => {
          if (prevTime === null || prevTime <= 0) {
            clearInterval(timer);
            if (!examCompleted) {
              handleSubmit();
            }
            return 0;
          }
          return prevTime - 1;
        });
      }
    }, 1000);

    setLocalStorageTimerId(timer);

    return () => {
      clearInterval(timer);
    };
  }, [exam, startTime, examCompleted]);

  // Save state to localStorage when it changes
  useEffect(() => {
    const saveState = () => {
      if (typeof window === 'undefined' || !exam || examCompleted) return;
      
      try {
        // Create a consolidated state object for consistency
        const examState = {
          responses: responses,
          timeLeft: timeLeft,
          startTime: startTime ? startTime.toISOString() : null,
          endTime: endTimeRef.current ? endTimeRef.current.toISOString() : null,
          questionIndex: currentQuestionIndex,
          tabChangeCount: tabChangeCount,
          examId: formId
        };
        
        // Save responses
        localStorage.setItem(`exam_responses_${formId}`, JSON.stringify(responses));
        
        // Save time left and calculate end time for better persistence
        if (timeLeft !== null) {
          localStorage.setItem(`exam_timeLeft_${formId}`, timeLeft.toString());
          
          // If we already have an end time reference, use that
          if (endTimeRef.current) {
            localStorage.setItem(`exam_endTime_${formId}`, endTimeRef.current.toISOString());
          } 
          // Otherwise calculate a new end time
          else if (startTime) {
            const now = new Date();
            const endTime = new Date(now.getTime() + (timeLeft * 1000));
            endTimeRef.current = endTime;
            localStorage.setItem(`exam_endTime_${formId}`, endTime.toISOString());
          }
        }
        
        // Save start time
        if (startTime) {
          localStorage.setItem(`exam_startTime_${formId}`, startTime.toISOString());
        }
        
        // Save current question index
        localStorage.setItem(`exam_questionIndex_${formId}`, currentQuestionIndex.toString());
        
        // Save tab change count
        localStorage.setItem(`exam_tabChangeCount_${formId}`, tabChangeCount.toString());
        
        // Additionally, save to sessionStorage as a backup
        try {
          sessionStorage.setItem(`exam_state_${formId}`, JSON.stringify(examState));
        } catch (e) {
          console.error("Could not save to sessionStorage:", e);
        }
      } catch (error) {
        console.error("Error saving exam state:", error);
      }
    };
    
    // Save state immediately
    saveState();
    
    // Set up regular saving to localStorage every 5 seconds
    const saveInterval = setInterval(saveState, 5000);
    
    return () => {
      clearInterval(saveInterval);
    };
  }, [exam, responses, timeLeft, startTime, currentQuestionIndex, tabChangeCount, examCompleted, formId]);

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
          
          // If this is the first load and we have a timeLimit, set the timer
          if (!startTime && data.timeLimit) {
            const savedEndTime = localStorage.getItem(`exam_endTime_${formId}`);
  
            // If there's a saved end time, use it to calculate the remaining time
            if (savedEndTime) {
              const parsedEndTime = new Date(savedEndTime);
              const now = new Date();
              const remainingTimeInSeconds = Math.max(0, Math.floor((parsedEndTime.getTime() - now.getTime()) / 1000));
              
              endTimeRef.current = parsedEndTime;
              setTimeLeft(remainingTimeInSeconds);
              
              // Calculate what the startTime would have been
              const originalDurationSeconds = data.timeLimit * 60;
              const elapsedSeconds = originalDurationSeconds - remainingTimeInSeconds;
              const calculatedStartTime = new Date(now.getTime() - elapsedSeconds * 1000);
              setStartTime(calculatedStartTime);
              
              console.log("Resuming exam with saved end time:", parsedEndTime.toISOString(), "remaining:", remainingTimeInSeconds);
            } else {
              // Otherwise set a new timer
              const newStartTime = new Date();
              setStartTime(newStartTime);
              
              // Make sure timeLeft is properly set
              const durationInSeconds = data.timeLimit * 60;
              setTimeLeft(durationInSeconds);
              
              // Set the absolute end time for persistence
              const endTime = new Date(newStartTime.getTime() + (durationInSeconds * 1000));
              endTimeRef.current = endTime;
              
              // Also save to localStorage immediately
              localStorage.setItem(`exam_timeLeft_${formId}`, durationInSeconds.toString());
              localStorage.setItem(`exam_endTime_${formId}`, endTime.toISOString());
              
              console.log("Setting initial timer:", { timeLimit: data.timeLimit, endTime: endTime.toISOString() });
            }
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
              localStorage.removeItem(`exam_endTime_${formId}`);
              localStorage.removeItem(`exam_questionIndex_${formId}`);
              localStorage.removeItem(`exam_tabChangeCount_${formId}`);
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

  // Format the time left into MM:SS
  const formatTimeLeft = () => {
    if (timeLeft === null) return "No time limit"
    
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Debug functions to log state
  useEffect(() => {
    console.log("Current timer state:", { 
      timeLeft, 
      formattedTime: formatTimeLeft(),
      startTime: startTime ? startTime.toISOString() : null,
      endTimeFromStorage: localStorage.getItem(`exam_endTime_${formId}`)
    });
    
    console.log("Tab change state:", {
      tabChangeCount,
      showTabWarning,
      storedCount: localStorage.getItem(`exam_tabChangeCount_${formId}`),
      docVisibility: document.visibilityState
    });
  }, [timeLeft, startTime, formId, tabChangeCount, showTabWarning]);

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
    if (isSubmitting || !exam?.questions) return
    
    // Log submission reason for debugging
    const isAutoSubmit = tabChangeCount >= 3 || timeLeft === 0;
    console.log("Exam submission initiated", { 
      tabChangeCount, 
      timeLeft,
      autoSubmit: isAutoSubmit,
      autoSubmitReason: tabChangeCount >= 3 ? "tab changes" : timeLeft === 0 ? "time expired" : "manual submission"
    });
    
    // Show a toast message if this is an auto-submission
    if (isAutoSubmit) {
      toast({
        title: "Exam Auto-Submitted",
        description: tabChangeCount >= 3 
          ? "Your exam has been auto-submitted because you changed tabs 3 times." 
          : "Your exam has been auto-submitted because the time limit has expired.",
        variant: "destructive",
      });
    }
    
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
    
    // If tab change count is 3 or time is up, bypass the required question check
    const bypassValidation = tabChangeCount >= 3 || timeLeft === 0;
    
    if (unansweredRequiredQuestions.length > 0 && !bypassValidation) {
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
        localStorage.removeItem(`exam_endTime_${formId}`);
        localStorage.removeItem(`exam_questionIndex_${formId}`);
        localStorage.removeItem(`exam_tabChangeCount_${formId}`);
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
    setTabChangeCount(0) // Reset tab change count
    setShowTabWarning(false) // Hide any warnings
    
    // Reset timer if exam has a time limit
    if (exam.timeLimit) {
      const newStartTime = new Date()
      setStartTime(newStartTime)
      setTimeLeft(exam.timeLimit * 60)
      
      // Calculate and save end time
      const durationInSeconds = exam.timeLimit * 60;
      const endTime = new Date(newStartTime.getTime() + (durationInSeconds * 1000));
      console.log("Setting up new iteration timer with end time:", endTime.toISOString());
    }
    
    // Clear localStorage data for this exam
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`exam_responses_${formId}`)
      localStorage.removeItem(`exam_timeLeft_${formId}`)
      localStorage.removeItem(`exam_startTime_${formId}`)
      localStorage.removeItem(`exam_endTime_${formId}`)
      localStorage.removeItem(`exam_questionIndex_${formId}`)
      localStorage.removeItem(`exam_tabChangeCount_${formId}`)
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
    setTabChangeCount(0) // Reset tab change count
    
    // Reset the form state for iteration
    if (exam && exam.questions) {
      const initialResponses = {};
      setResponses(initialResponses);
    }
    
    // If there's a time limit, reset the timer for the iteration
    if (exam?.timeLimit) {
      const newStartTime = new Date()
      setStartTime(newStartTime)
      setTimeLeft(exam.timeLimit * 60)
      
      // Also save to localStorage immediately with the new endTime calculation
      localStorage.setItem(`exam_timeLeft_${formId}`, (exam.timeLimit * 60).toString());
      const endTime = new Date(newStartTime.getTime() + (exam.timeLimit * 60 * 1000));
      localStorage.setItem(`exam_endTime_${formId}`, endTime.toISOString());
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

  // Make sure renderTimer is defined before return
  const renderTimer = () => {
    if (!timeLeft) return null;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const isLowTime = timeLeft <= 300; // 5 minutes or less
    return (
      <div className={`flex items-center gap-2 ${isLowTime ? 'text-red-500' : ''}`}>
        <Clock className="h-4 w-4" />
        <span className="font-medium">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    );
  };

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
            {renderTimer()}
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