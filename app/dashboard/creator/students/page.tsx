"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import {
  Loader2,
  Search,
  MoreHorizontal,
  Mail,
  Download,
  ArrowUpDown,
  MessageSquare,
  UserPlus,
  Users,
  GraduationCap,
  Clock,
  BookOpen,
  Calendar,
} from "lucide-react"
import { useCreatorCourses, useCreatorEnrolledStudents, useStudentDetails, useRemoveStudentEnrollment } from "@/lib/react-query/queries"
import { formatDistanceToNow } from "date-fns"

export default function StudentsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCourse, setSelectedCourse] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  
  // State for enrollment management dialogs
  const [isManageEnrollmentOpen, setIsManageEnrollmentOpen] = useState(false)
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] = useState(false)
  const [studentToManage, setStudentToManage] = useState<any>(null)
  const [courseToRemove, setCourseToRemove] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch courses data
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()
  
  // Fetch enrolled students data
  const { data: studentsData, isLoading: studentsLoading } = useCreatorEnrolledStudents()
  
  // Fetch selected student details if a student is selected
  const { data: studentDetails, isLoading: studentDetailsLoading } = useStudentDetails(selectedStudent || "")
  
  // Mutation for removing student enrollment
  const { mutate: removeStudentEnrollment, isPending } = useRemoveStudentEnrollment()

  // Filter students based on search query and filters
  const filteredStudents = studentsData ? studentsData.filter((student: any) => {
    const matchesSearch =
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = selectedStatus === "all" || student.status === selectedStatus
    
    const matchesCourse = selectedCourse === "all" || 
      student.coursesEnrolled.some((course: any) => course.id === selectedCourse)

    return matchesSearch && matchesStatus && matchesCourse
  }) : []

  if (status === "loading" || coursesLoading || studentsLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading student data...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="text-muted-foreground mt-1">Manage and track your students' progress</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Invite Students</span>
          </Button>

          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </Button>
        </div>
      </div>

      {/* Student stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{studentsData?.length || 0}</div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {studentsData?.filter((s: any) => s.status === "active").length || 0}
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {studentsData?.length > 0
                  ? Math.round(
                      studentsData.reduce((acc: number, student: any) => acc + student.completionRate, 0) /
                        studentsData.length
                    )
                  : 0}
                %
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recently Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {studentsData?.filter((s: any) => {
                  const lastActive = new Date(s.lastActive)
                  const now = new Date()
                  const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
                  return diffDays <= 7
                }).length || 0}
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage your enrolled students</CardDescription>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses?.map((course: any) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Enrolled
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No students found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student: any) => (
                      <TableRow
                        key={student.id}
                        className={selectedStudent === student.id ? "bg-muted/50" : ""}
                        onClick={() => setSelectedStudent(student.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={student.image || "/placeholder.svg"} alt={student.name} />
                              <AvatarFallback>{student.name?.charAt(0) || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{student.name || "Unnamed Student"}</div>
                              <div className="text-sm text-muted-foreground">{student.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(student.enrolledAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(student.enrolledAt), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>{student.totalCoursesEnrolled || student.coursesEnrolled?.length || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[80px] h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  student.completionRate > 75
                                    ? "bg-green-500"
                                    : student.completionRate > 40
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${student.completionRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{student.completionRate || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.status === "active" ? "default" : "secondary"}>
                            {student.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                <span>Email Student</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                <span>Send Message</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Users className="h-4 w-4 mr-2" />
                                <span>View Profile</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setStudentToManage(student);
                                setIsManageEnrollmentOpen(true);
                              }}>
                                <GraduationCap className="h-4 w-4 mr-2" />
                                <span>Manage Enrollments</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredStudents.length} of {studentsData?.length || 0} students
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        <div>
          {selectedStudent ? (
            <Card>
              <CardHeader>
                <CardTitle>Student Details</CardTitle>
                <CardDescription>View detailed information about this student</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {studentDetailsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : studentDetails ? (
                  <>
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="h-20 w-20 mb-4">
                        <AvatarImage src={studentDetails.image || "/placeholder.svg"} alt={studentDetails.name} />
                        <AvatarFallback>{studentDetails.name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <h3 className="text-xl font-semibold">{studentDetails.name || "Unnamed Student"}</h3>
                      <p className="text-muted-foreground">{studentDetails.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={studentDetails.status === "active" ? "default" : "secondary"}>
                          {studentDetails.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Enrollment Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Enrolled Since</div>
                        <div>{new Date(studentDetails.enrolledAt).toLocaleDateString()}</div>
                        <div className="text-muted-foreground">Courses Enrolled</div>
                        <div>{studentDetails.coursesEnrolled}</div>
                        <div className="text-muted-foreground">Completion Rate</div>
                        <div>{studentDetails.completionRate}%</div>
                        <div className="text-muted-foreground">Last Active</div>
                        <div>
                          {formatDistanceToNow(new Date(studentDetails.lastActive), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Course Progress</h4>
                      <div className="space-y-3">
                        {studentDetails.courses.map((course: any) => (
                          <div key={course.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{course.title}</span>
                              <span>{course.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  course.progress > 75
                                    ? "bg-green-500"
                                    : course.progress > 40
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${course.progress}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {course.completedLectures} of {course.totalLectures} lectures completed
                              </span>
                              <span>
                                Enrolled {formatDistanceToNow(new Date(course.enrolledAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Activity</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 rounded-md border border-border">
                          <div className="p-2 rounded-full bg-primary/10">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">Last accessed course content</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(studentDetails.lastActive), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-md border border-border">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">First enrolled</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(studentDetails.enrolledAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    Failed to load student details
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>Email</span>
                </Button>
                <Button size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span>Message</span>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Student Selected</h3>
                <p className="text-muted-foreground mb-4">Select a student from the list to view their details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Manage Student Enrollments Dialog */}
      <Dialog open={isManageEnrollmentOpen} onOpenChange={setIsManageEnrollmentOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Student Enrollments</DialogTitle>
            <DialogDescription>
              Review and manage course enrollments for {studentToManage?.name || "this student"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {studentToManage?.coursesEnrolled?.length ? (
              studentToManage.coursesEnrolled.map((course: any) => (
                <div key={course.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">{course.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Enrolled: {new Date(course.enrolledAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      setCourseToRemove(course.id);
                      setIsRemoveStudentDialogOpen(true);
                    }}
                  >
                    Unenroll
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                This student is not enrolled in any courses
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageEnrollmentOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Enrollment Dialog */}
      <AlertDialog open={isRemoveStudentDialogOpen} onOpenChange={setIsRemoveStudentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Course Enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this student from this course? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!courseToRemove || !studentToManage) return;
                
                setIsProcessing(true);
                
                try {
                  // Call the mutation to remove the enrollment
                  await removeStudentEnrollment({ 
                    studentId: studentToManage.id, 
                    courseId: courseToRemove 
                  });
                  
                  toast({
                    title: "Enrollment removed",
                    description: "Student has been unenrolled from the course",
                  });

                  // Close dialogs and reset states
                  setIsRemoveStudentDialogOpen(false);
                  setIsManageEnrollmentOpen(false);
                  setCourseToRemove(null);
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to remove enrollment. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing || isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                "Remove Enrollment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
