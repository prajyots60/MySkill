"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle, Edit2, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface QuestionEditorProps {
  examId: string
  onQuestionCreated?: () => void
}

export function QuestionEditor({ examId, onQuestionCreated }: QuestionEditorProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  
  // Current question state
  const [text, setText] = useState("")
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE")
  const [required, setRequired] = useState(true)
  const [points, setPoints] = useState<number>(1)
  const [negativeMarking, setNegativeMarking] = useState<number | null>(null)
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ])

  // Add a new option
  const addOption = () => {
    setOptions([...options, { text: "", isCorrect: false }])
  }

  // Remove an option
  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast({
        title: "Error",
        description: "You need at least 2 options",
        variant: "destructive",
      })
      return
    }
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  // Update option text
  const updateOptionText = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index].text = value
    setOptions(newOptions)
  }

  // Toggle correct answer for multiple choice
  const toggleCorrectForMultipleChoice = (index: number) => {
    if (questionType !== "MULTIPLE_CHOICE") return
    
    // For multiple choice, only one option can be correct
    const newOptions = options.map((option, i) => ({
      ...option,
      isCorrect: i === index
    }))
    setOptions(newOptions)
  }

  // Toggle correct answer for checkbox
  const toggleCorrectForCheckbox = (index: number) => {
    if (questionType !== "CHECKBOX") return
    
    // For checkbox, multiple options can be correct
    const newOptions = [...options]
    newOptions[index].isCorrect = !newOptions[index].isCorrect
    setOptions(newOptions)
  }

  // Validate current question
  const validateCurrentQuestion = () => {
    if (!text) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      })
      return false
    }

    // For multiple choice and checkbox, we need at least one correct answer
    if ((questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX") && 
        !options.some(option => option.isCorrect)) {
      toast({
        title: "Error",
        description: "Please mark at least one correct answer",
        variant: "destructive",
      })
      return false
    }

    // Make sure all options have text
    if ((questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX") && 
        options.some(option => !option.text.trim())) {
      toast({
        title: "Error",
        description: "All options must have text",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  // Add question to batch
  const addQuestionToBatch = () => {
    if (!validateCurrentQuestion()) return

    const newQuestion = {
      text,
      type: questionType,
      required,
      order: questions.length,
      points,
      negativeMarking: negativeMarking || undefined,
      options: questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX" ? options : undefined,
    }

    setQuestions([...questions, newQuestion])
    
    // Reset form for next question
    setText("")
    setQuestionType("MULTIPLE_CHOICE")
    setOptions([
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ])
    setPoints(1)
    setNegativeMarking(null)
    
    toast({
      title: "Success",
      description: `Question added to batch (${questions.length + 1} total)`,
    })
  }

  // Remove question from batch
  const removeQuestionFromBatch = (index: number) => {
    const newQuestions = [...questions]
    newQuestions.splice(index, 1)
    setQuestions(newQuestions)
  }

  // Submit all questions in batch
  const submitBatch = async () => {
    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "No questions to submit",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)

      const response = await fetch(`/api/exams/${examId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(questions),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to create questions")
      }

      toast({
        title: "Success",
        description: `${questions.length} questions added successfully`,
      })

      // Reset batch
      setQuestions([])

      if (onQuestionCreated) {
        onQuestionCreated()
      }
    } catch (error) {
      console.error("Error creating questions:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create questions",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Create a single question (original functionality)
  const handleCreateQuestion = async () => {
    if (!validateCurrentQuestion()) return

    try {
      setIsCreating(true)

      const response = await fetch(`/api/exams/${examId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          type: questionType,
          required,
          points,
          negativeMarking: negativeMarking || undefined,
          options: questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX" ? options : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to create question")
      }

      toast({
        title: "Success",
        description: "Question added successfully",
      })

      // Reset form
      setText("")
      setQuestionType("MULTIPLE_CHOICE")
      setOptions([
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ])
      setPoints(1)
      setNegativeMarking(null)

      if (onQuestionCreated) {
        onQuestionCreated()
      }
    } catch (error) {
      console.error("Error creating question:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create question",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Questions</CardTitle>
        <CardDescription>
          Create questions for your exam
        </CardDescription>
        <div className="flex items-center space-x-2 pt-2">
          <Switch 
            id="batch-mode" 
            checked={batchMode} 
            onCheckedChange={setBatchMode} 
          />
          <Label htmlFor="batch-mode">Batch mode (create multiple questions at once)</Label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="text">Question Text</Label>
            <Textarea
              id="text"
              placeholder="Enter your question here"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="type">Question Type</Label>
            <Select
              value={questionType}
              onValueChange={setQuestionType}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select question type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MULTIPLE_CHOICE">Multiple Choice (Single Answer)</SelectItem>
                <SelectItem value="CHECKBOX">Multiple Choice (Multiple Answers)</SelectItem>
                <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                <SelectItem value="PARAGRAPH">Paragraph</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX") && (
            <div className="space-y-3">
              <Label>Options</Label>
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {questionType === "MULTIPLE_CHOICE" ? (
                    <RadioGroup value={option.isCorrect ? "correct" : ""}>
                      <RadioGroupItem
                        value="correct"
                        onClick={() => toggleCorrectForMultipleChoice(index)}
                      />
                    </RadioGroup>
                  ) : (
                    <Checkbox
                      checked={option.isCorrect}
                      onCheckedChange={() => toggleCorrectForCheckbox(index)}
                    />
                  )}
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="negative-marking">Negative Marking (Optional)</Label>
              <Input
                id="negative-marking"
                type="number"
                min="0"
                value={negativeMarking === null ? "" : negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.value === "" ? null : parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={required}
              onCheckedChange={setRequired}
            />
            <Label htmlFor="required">Required</Label>
          </div>
        </div>
        
        {batchMode && questions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium">Questions in Batch ({questions.length})</h3>
            <div className="mt-2 space-y-2">
              {questions.map((q, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
                  <div className="flex-1 mr-2 truncate">
                    <span className="font-medium">Q{index + 1}:</span> {q.text}
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline">{q.type}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestionFromBatch(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {batchMode ? (
          <>
            <Button
              variant="outline"
              onClick={addQuestionToBatch}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Batch
            </Button>
            <Button
              onClick={submitBatch}
              disabled={isCreating || questions.length === 0}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Submit All Questions ({questions.length})
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            onClick={handleCreateQuestion}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Question
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}