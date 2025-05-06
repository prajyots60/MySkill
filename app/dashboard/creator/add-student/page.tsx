"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Search, UserCheck, UserX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Course {
  id: string;
  title: string;
}

interface VerifiedStudent {
  id: string;
  name: string;
  email: string;
}

export default function AddStudentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [studentEmail, setStudentEmail] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fetchingCourses, setFetchingCourses] = useState(true);
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudent | null>(null);

  // Fetch creator's courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch("/api/creator/courses");
        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }
        
        const data = await response.json();
        setCourses(data.courses || []);
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError("Failed to load courses. Please try again.");
      } finally {
        setFetchingCourses(false);
      }
    };

    if (session?.user.role === "CREATOR") {
      fetchCourses();
    }
  }, [session]);

  // Function to verify student existence
  const verifyStudent = async () => {
    if (!studentEmail) return;
    
    setVerifying(true);
    setError("");
    setVerifiedStudent(null);
    
    try {
      // First, try to verify if the student exists with the same API
      const response = await fetch("/api/creators/add-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          studentEmail, 
          courseId: selectedCourseId 
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Student was successfully enrolled
        setSuccess("Student successfully added to the course.");
        setStudentEmail("");
        setVerifiedStudent(null);
        return;
      } 
      
      // Handle different verification error scenarios
      if (result.status === "NOT_FOUND") {
        setError("No student found with this email. The student must have an account on the platform.");
      } else if (result.status === "INVALID_ROLE") {
        setError("This email belongs to a non-student account.");
      } else if (result.status === "ALREADY_ENROLLED") {
        setError("Student is already enrolled in this course.");
      } else {
        setError(result.error || "Failed to verify student");
      }
      
    } catch (err: any) {
      setError(err.message || "Failed to verify student");
    } finally {
      setVerifying(false);
    }
  };

  // Function to add verified student to the course
  const addStudentToCourse = async () => {
    if (!verifiedStudent || !selectedCourseId) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/creators/add-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          studentEmail: verifiedStudent.email, 
          courseId: selectedCourseId 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add student");
      }

      setSuccess("Student successfully added to the course.");
      setStudentEmail("");
      setVerifiedStudent(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session || session.user.role !== "CREATOR") {
    router.push("/dashboard/creator");
    return null;
  }

  return (
    <div className="container max-w-4xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Add Student to Course</CardTitle>
          <CardDescription>
            Manually grant course access to students by email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert variant="success" className="mb-6 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={(e) => {
            e.preventDefault();
            verifyStudent();
          }} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="studentEmail">Student Email</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="studentEmail"
                  type="email"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => {
                    setStudentEmail(e.target.value);
                    // Clear verified student when email changes
                    if (verifiedStudent) setVerifiedStudent(null);
                  }}
                  required
                  className="flex-1"
                />
                <Button 
                  type="submit"
                  disabled={verifying || !studentEmail || courses.length === 0}
                  variant="outline"
                >
                  {verifying ? (
                    <>Verifying...</>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Verify Student
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The student must already have an account on the platform
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="courseSelect">Select Course</Label>
              <Select 
                value={selectedCourseId} 
                onValueChange={setSelectedCourseId}
                disabled={fetchingCourses || courses.length === 0}
              >
                <SelectTrigger id="courseSelect">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {fetchingCourses ? (
                    <SelectItem value="loading" disabled>
                      Loading courses...
                    </SelectItem>
                  ) : courses.length > 0 ? (
                    courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No courses available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {courses.length === 0 && !fetchingCourses && (
                <p className="text-sm text-muted-foreground">
                  You don't have any courses. Create a course first to add students.
                </p>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={verifyStudent}
            disabled={loading || verifying || !studentEmail || !selectedCourseId || fetchingCourses}
          >
            {loading ? "Adding Student..." : "Add Student to Course"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}