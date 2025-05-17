import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExamTaker from "@/components/exam-taker"
import { prisma } from "@/lib/db"
import { isStudentEnrolledForExam } from "@/lib/server/student-exams"

interface ExamPageProps {
  params: {
    formId: string
  }
}

export const metadata: Metadata = {
  title: "Take Exam",
  description: "Take an exam or quiz",
}

export default async function ExamPage({ params }: ExamPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/exams/" + params.formId + "/take")
  }
  
  const { formId } = await params
  
  // Find the exam and its associated course
  const exam = await prisma.exam.findFirst({
    where: { formId: formId },
    include: { content: true }
  })
  
  if (!exam) {
    redirect("/dashboard?error=exam-not-found")
  }
  
  // Check if the exam's scheduled start date has arrived
  if (exam.startDate && new Date(exam.startDate) > new Date()) {
    // Format the date for display in the message
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date(exam.startDate));
    
    // Redirect to dashboard with error message
    redirect(`/dashboard/student?error=exam-not-available&message=This exam will be available on ${formattedDate}`)
  }
  
  // If user is not a creator/admin, verify they're enrolled in the course
  if (session.user.role === "STUDENT" && exam.contentId) {
    // Check if the student is enrolled in the course using our utility
    const isEnrolled = await isStudentEnrolledForExam(session.user.id, exam.id)
    
    // If not enrolled, redirect to dashboard with error
    if (!isEnrolled) {
      redirect(`/dashboard/student?error=not-enrolled&course=${exam.contentId}`)
    }
  }
  
  // For creators, check if they created this exam
  if (session.user.role === "CREATOR" && exam.creatorId !== session.user.id) {
    // Optional: You can restrict creators to only their own exams
    // Uncomment the following line to enforce this restriction
    // redirect("/dashboard/creator?error=not-authorized")
  }
  
  return (
    <div className="container py-8">
      <ExamTaker formId={formId} />
    </div>
  )
}