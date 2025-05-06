"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ThumbsUp, MessageSquare, Check, User } from "lucide-react"
import { QuestionItem } from "../types/creator.types"
import { formatRelativeTime } from "../utils/dateFormatters"

interface QuestionsListProps {
  questions: QuestionItem[];
  themeColor?: string;
  isAuthenticated?: boolean;
}

const QuestionsList: React.FC<QuestionsListProps> = ({
  questions,
  themeColor = "default",
  isAuthenticated = false
}) => {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [newQuestion, setNewQuestion] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Filter questions into answered and unanswered
  const answeredQuestions = questions.filter(q => q.answered)
  const unansweredQuestions = questions.filter(q => !q.answered)
  
  // Handler for question submission
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !isAuthenticated) return
    
    setIsSubmitting(true)
    
    // Here you would typically call an API to submit the question
    // This is a placeholder for the actual implementation
    setTimeout(() => {
      setNewQuestion("")
      setIsSubmitting(false)
      // You'd typically update the questions state here with the new question
    }, 1000)
  }
  
  // Handler for upvote action
  const handleUpvote = (questionId: string) => {
    if (!isAuthenticated) return
    // Implementation would go here
  }
  
  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No questions yet</h3>
        <p className="text-muted-foreground mb-6">
          Be the first to ask this creator a question.
        </p>
        
        {isAuthenticated ? (
          <form onSubmit={handleQuestionSubmit} className="max-w-lg mx-auto">
            <Textarea
              placeholder="Ask the creator a question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="mb-4"
            />
            <Button type="submit" disabled={!newQuestion.trim() || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Question"}
            </Button>
          </form>
        ) : (
          <Button>Sign in to Ask Questions</Button>
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-8">
      {/* Question form for authenticated users */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ask a Question</CardTitle>
            <CardDescription>
              Your question will be visible to the creator and the community.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleQuestionSubmit}>
            <CardContent>
              <Textarea
                placeholder="What would you like to know?"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!newQuestion.trim() || isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Question"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
      
      {/* Unanswered questions section */}
      {unansweredQuestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Open Questions</h3>
          
          {unansweredQuestions.map(question => (
            <Card key={question.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={question.user.image} alt={question.user.name} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{question.user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(question.createdAt)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Awaiting Answer
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm">{question.question}</p>
              </CardContent>
              <CardFooter className="border-t bg-muted/50 py-2 px-6">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleUpvote(question.id)}
                  disabled={!isAuthenticated}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>Upvote</span>
                  {question.upvotes > 0 && (
                    <span className="ml-1">({question.upvotes})</span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Answered questions section */}
      {answeredQuestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center">
            <Check className="h-5 w-5 mr-2 text-green-500" />
            Answered Questions
          </h3>
          
          {answeredQuestions.map(question => (
            <Card key={question.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={question.user.image} alt={question.user.name} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{question.user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(question.createdAt)}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-xs border-green-500/20">
                    Answered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm">{question.question}</p>
                
                {question.answer && (
                  <div className="mt-4 border-l-2 border-muted-foreground/20 pl-4">
                    <p className="text-sm font-medium">Creator's Answer:</p>
                    <p className="text-sm mt-1">{question.answer.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatRelativeTime(question.answer.createdAt)}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t bg-muted/50 py-2 px-6">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleUpvote(question.id)}
                  disabled={!isAuthenticated}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>Upvote</span>
                  {question.upvotes > 0 && (
                    <span className="ml-1">({question.upvotes})</span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuestionsList