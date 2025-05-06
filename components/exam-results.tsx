"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertCircle,
  ChevronDown, 
  ChevronUp, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  Search, 
  User,
  BarChart3,
  PieChart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/utils/format"

interface ExamResultsProps {
  examId: string
}

interface StudentResponse {
  id: string
  studentId: string
  studentName: string
  submittedAt: string
  score: number
  maxScore: number
  timeSpent: number
  answers: {
    questionId: string
    questionText: string
    answerText: string
    isCorrect: boolean
    points: number
    maxPoints: number
  }[]
}

export default function ExamResults({ examId }: ExamResultsProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [filteredResponses, setFilteredResponses] = useState<StudentResponse[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("student-responses")
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState({ key: "submittedAt", direction: "desc" as "asc" | "desc" })
  const [stats, setStats] = useState({
    totalResponses: 0,
    averageScore: 0,
    medianScore: 0,
    highestScore: 0,
    lowestScore: 0,
    passRate: 0,
    averageTimeSpent: 0,
    questionStats: [] as {
      questionId: string,
      questionText: string,
      correctRate: number,
      averagePoints: number,
      maxPoints: number
    }[]
  })
  
  // Load responses
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/exams/${examId}/responses`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch responses")
        }
        
        const data = await response.json()
        
        if (data.success && data.responses) {
          setResponses(data.responses)
          setFilteredResponses(data.responses)
          calculateStats(data.responses)
        } else {
          throw new Error(data.message || "Failed to fetch responses")
        }
      } catch (error) {
        console.error("Error fetching responses:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load responses",
          variant: "destructive",
        })
        setResponses([])
        setFilteredResponses([])
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchResponses()
  }, [examId, toast])
  
  // Calculate statistics
  const calculateStats = (responses: StudentResponse[]) => {
    if (responses.length === 0) {
      setStats({
        totalResponses: 0,
        averageScore: 0,
        medianScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0,
        averageTimeSpent: 0,
        questionStats: []
      })
      return
    }
    
    // Basic stats
    const scores = responses.map(r => (r.score / r.maxScore) * 100)
    scores.sort((a, b) => a - b)
    
    const totalResponsesCount = responses.length
    const avgScore = scores.reduce((a, b) => a + b, 0) / totalResponsesCount
    const medianScoreValue = totalResponsesCount % 2 === 0 
      ? (scores[totalResponsesCount / 2 - 1] + scores[totalResponsesCount / 2]) / 2 
      : scores[Math.floor(totalResponsesCount / 2)]
    const highestScoreValue = Math.max(...scores)
    const lowestScoreValue = Math.min(...scores)
    const passRateValue = (scores.filter(s => s >= 60).length / totalResponsesCount) * 100
    const avgTimeSpent = responses.reduce((a, b) => a + b.timeSpent, 0) / totalResponsesCount
    
    // Question stats
    const questionMap = new Map()
    
    responses.forEach(response => {
      response.answers.forEach(answer => {
        if (!questionMap.has(answer.questionId)) {
          questionMap.set(answer.questionId, {
            questionId: answer.questionId,
            questionText: answer.questionText,
            correctCount: 0,
            totalCount: 0,
            totalPoints: 0,
            maxPoints: answer.maxPoints
          })
        }
        
        const questionStat = questionMap.get(answer.questionId)
        questionStat.totalCount++
        
        if (answer.isCorrect) {
          questionStat.correctCount++
        }
        
        questionStat.totalPoints += answer.points
      })
    })
    
    const questionStatsArray = Array.from(questionMap.values()).map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      correctRate: (q.correctCount / q.totalCount) * 100,
      averagePoints: q.totalPoints / q.totalCount,
      maxPoints: q.maxPoints
    }))
    
    setStats({
      totalResponses: totalResponsesCount,
      averageScore: avgScore,
      medianScore: medianScoreValue,
      highestScore: highestScoreValue,
      lowestScore: lowestScoreValue,
      passRate: passRateValue,
      averageTimeSpent: avgTimeSpent,
      questionStats: questionStatsArray
    })
  }
  
  // Handle search
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredResponses(responses)
    } else {
      const searchTermLower = searchTerm.toLowerCase()
      const filtered = responses.filter(r => 
        r.studentName.toLowerCase().includes(searchTermLower) ||
        r.studentId.toLowerCase().includes(searchTermLower)
      )
      setFilteredResponses(filtered)
    }
  }, [searchTerm, responses])
  
  // Handle sorting
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc"
    }
    
    setSortConfig({ key, direction })
    
    const sortedResponses = [...filteredResponses].sort((a, b) => {
      // Handle different data types
      if (key === "studentName") {
        return direction === "asc" 
          ? a.studentName.localeCompare(b.studentName)
          : b.studentName.localeCompare(a.studentName)
      } else if (key === "submittedAt") {
        return direction === "asc" 
          ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
          : new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      } else if (key === "score") {
        const scoreA = (a.score / a.maxScore) * 100
        const scoreB = (b.score / b.maxScore) * 100
        return direction === "asc" ? scoreA - scoreB : scoreB - scoreA
      } else if (key === "timeSpent") {
        return direction === "asc" ? a.timeSpent - b.timeSpent : b.timeSpent - a.timeSpent
      }
      
      return 0
    })
    
    setFilteredResponses(sortedResponses)
  }
  
  // Toggle expanded student details
  const toggleExpandStudent = (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null)
    } else {
      setExpandedStudent(studentId)
    }
  }
  
  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }
  
  // Export to CSV
  const exportToCSV = () => {
    if (responses.length === 0) return
    
    // Create headers
    let csvContent = "Student ID,Student Name,Submitted At,Score,Percentage,Time Spent\n"
    
    // Add data rows
    responses.forEach(response => {
      const row = [
        response.studentId,
        response.studentName,
        response.submittedAt,
        `${response.score}/${response.maxScore}`,
        `${((response.score / response.maxScore) * 100).toFixed(2)}%`,
        formatTimeSpent(response.timeSpent)
      ].map(cell => `"${cell}"`).join(",")
      
      csvContent += row + "\n"
    })
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `exam-results-${examId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  // Export detailed responses to CSV
  const exportDetailedToCSV = () => {
    if (responses.length === 0) return
    
    // Create headers with question columns
    const allQuestions = new Set<string>()
    responses.forEach(response => {
      response.answers.forEach(answer => {
        allQuestions.add(answer.questionId)
      })
    })
    
    const questionColumns = Array.from(allQuestions).sort()
    
    let csvContent = "Student ID,Student Name,Submitted At,Score,Percentage,Time Spent"
    questionColumns.forEach((qId, index) => {
      // Find question text for the header
      const questionText = responses.find(r => 
        r.answers.some(a => a.questionId === qId)
      )?.answers.find(a => a.questionId === qId)?.questionText || `Question ${index + 1}`
      
      csvContent += `,${questionText} (Answer),${questionText} (Correct),${questionText} (Points)`
    })
    csvContent += "\n"
    
    // Add data rows
    responses.forEach(response => {
      let row = [
        response.studentId,
        response.studentName,
        response.submittedAt,
        `${response.score}/${response.maxScore}`,
        `${((response.score / response.maxScore) * 100).toFixed(2)}%`,
        formatTimeSpent(response.timeSpent)
      ].map(cell => `"${cell}"`).join(",")
      
      // Add question data
      questionColumns.forEach(qId => {
        const answer = response.answers.find(a => a.questionId === qId)
        
        if (answer) {
          row += `,"${answer.answerText}","${answer.isCorrect ? 'Yes' : 'No'}","${answer.points}/${answer.maxPoints}"`
        } else {
          row += `,"Not answered","No","0/0"`
        }
      })
      
      csvContent += row + "\n"
    })
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `exam-detailed-results-${examId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Responses</CardTitle>
          <CardDescription>
            Loading exam responses data...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Responses</CardTitle>
          <CardDescription>
            View and manage student submissions for this exam
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No responses yet</p>
            <p className="text-sm mt-1">Students haven't submitted any responses for this exam.</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="student-responses">
            <User className="h-4 w-4 mr-2" />
            Student Responses
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="student-responses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Student Responses</CardTitle>
                  <CardDescription>
                    {responses.length} student{responses.length === 1 ? " has" : "s have"} completed this exam.
                  </CardDescription>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export Basic CSV
                  </Button>
                  <Button variant="outline" onClick={exportDetailedToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Detailed CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by student name or ID..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          <button 
                            className="flex items-center"
                            onClick={() => handleSort("studentName")}
                          >
                            Student
                            {sortConfig.key === "studentName" && (
                              sortConfig.direction === "asc" 
                                ? <ChevronUp className="h-4 w-4 ml-1" /> 
                                : <ChevronDown className="h-4 w-4 ml-1" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          <button 
                            className="flex items-center"
                            onClick={() => handleSort("submittedAt")}
                          >
                            Submitted
                            {sortConfig.key === "submittedAt" && (
                              sortConfig.direction === "asc" 
                                ? <ChevronUp className="h-4 w-4 ml-1" /> 
                                : <ChevronDown className="h-4 w-4 ml-1" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          <button 
                            className="flex items-center"
                            onClick={() => handleSort("score")}
                          >
                            Score
                            {sortConfig.key === "score" && (
                              sortConfig.direction === "asc" 
                                ? <ChevronUp className="h-4 w-4 ml-1" /> 
                                : <ChevronDown className="h-4 w-4 ml-1" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          <button 
                            className="flex items-center"
                            onClick={() => handleSort("timeSpent")}
                          >
                            Time Spent
                            {sortConfig.key === "timeSpent" && (
                              sortConfig.direction === "asc" 
                                ? <ChevronUp className="h-4 w-4 ml-1" /> 
                                : <ChevronDown className="h-4 w-4 ml-1" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResponses.map((response) => (
                        <React.Fragment key={response.id}>
                          <tr className={`border-t ${expandedStudent === response.studentId ? 'bg-muted/30' : ''}`}>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium">{response.studentName}</div>
                              <div className="text-xs text-muted-foreground">{response.studentId}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">{formatDate(new Date(response.submittedAt))}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <div>
                                  {response.score}/{response.maxScore} ({Math.round((response.score / response.maxScore) * 100)}%)
                                </div>
                                <Badge 
                                  variant={(response.score / response.maxScore) >= 0.6 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {(response.score / response.maxScore) >= 0.6 ? "Passed" : "Failed"}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{formatTimeSpent(response.timeSpent)}</td>
                            <td className="px-4 py-3 text-sm">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleExpandStudent(response.studentId)}
                              >
                                {expandedStudent === response.studentId ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                    View Details
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                          
                          {expandedStudent === response.studentId && (
                            <tr className="border-t">
                              <td colSpan={5} className="px-4 py-4 bg-muted/20">
                                <div className="space-y-4">
                                  <h4 className="font-medium text-sm">Responses Details</h4>
                                  
                                  <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-muted/50">
                                          <th className="px-3 py-2 text-left font-medium">#</th>
                                          <th className="px-3 py-2 text-left font-medium">Question</th>
                                          <th className="px-3 py-2 text-left font-medium">Answer</th>
                                          <th className="px-3 py-2 text-left font-medium">Result</th>
                                          <th className="px-3 py-2 text-left font-medium">Points</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {response.answers.map((answer, index) => (
                                          <tr key={answer.questionId} className={index % 2 === 0 ? "bg-muted/10" : ""}>
                                            <td className="px-3 py-2">{index + 1}</td>
                                            <td className="px-3 py-2">{answer.questionText}</td>
                                            <td className="px-3 py-2">{answer.answerText}</td>
                                            <td className="px-3 py-2">
                                              <Badge 
                                                variant={answer.isCorrect ? "secondary" : "destructive"}
                                                className="text-xs"
                                              >
                                                {answer.isCorrect ? "Correct" : "Incorrect"}
                                              </Badge>
                                            </td>
                                            <td className="px-3 py-2">{answer.points}/{answer.maxPoints}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {filteredResponses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-t mt-1">
                  <p>No matching students found. Try adjusting your search.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Performance Overview</CardTitle>
              <CardDescription>
                Statistical analysis of student performance in this exam
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Responses</div>
                  <div className="text-2xl font-bold">{stats.totalResponses}</div>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Average Score</div>
                  <div className="text-2xl font-bold">{stats.averageScore.toFixed(2)}%</div>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Pass Rate</div>
                  <div className="text-2xl font-bold">{stats.passRate.toFixed(2)}%</div>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Avg Time Spent</div>
                  <div className="text-2xl font-bold">{formatTimeSpent(stats.averageTimeSpent)}</div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div>
                <h3 className="text-lg font-medium mb-4">Question Performance</h3>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-2 text-left text-sm font-medium">#</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Question</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Correct Rate</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Avg Points</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.questionStats.map((question, index) => (
                        <tr key={question.questionId} className="border-t">
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3 text-sm">{question.questionText}</td>
                          <td className="px-4 py-3 text-sm">{question.correctRate.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-sm">{question.averagePoints.toFixed(2)}/{question.maxPoints}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge 
                              variant={
                                question.correctRate >= 75 ? "secondary" :
                                question.correctRate >= 40 ? "outline" :
                                "destructive"
                              }
                              className="text-xs"
                            >
                              {question.correctRate >= 75 ? "Easy" :
                               question.correctRate >= 40 ? "Medium" :
                               "Difficult"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="text-sm text-muted-foreground mt-4">
                  <p>* Questions with a correct rate below 40% may be too difficult or need clarification.</p>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div>
                <h3 className="text-lg font-medium mb-4">Score Distribution</h3>
                
                <div className="h-48 bg-muted/30 rounded-lg flex items-end">
                  {/* Score distribution chart would go here - simplified for now */}
                  <div className="flex items-end justify-around w-full h-full p-4">
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(score => {
                      // Calculate how many students scored in this range
                      const count = responses.filter(r => {
                        const percent = (r.score / r.maxScore) * 100
                        return percent >= score && percent < score + 10
                      }).length
                      
                      // Calculate height as percentage of max height
                      const height = stats.totalResponses ? (count / stats.totalResponses) * 100 : 0
                      
                      return (
                        <div key={score} className="flex flex-col items-center">
                          <div 
                            className={`w-6 ${count > 0 ? 'bg-primary' : 'bg-muted'} rounded-t`}
                            style={{ height: `${Math.max(height * 2, 5)}%` }}
                          ></div>
                          <div className="text-xs mt-1">{score}-{score+9}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground text-center mt-2">
                  Score Ranges (%)
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}