import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExamTaker from "@/components/exam-taker"
import { prisma } from "@/lib/db"

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
  
  // If user is not a creator/admin, verify they're enrolled in the course
  if (session.user.role === "STUDENT" && exam.content) {
    // The content IS the course, so we use contentId
    const contentId = exam.contentId;
    
    if (contentId) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: session.user.id,
          contentId: contentId,
        }
      })
      
      // If not enrolled, redirect to dashboard with error
      if (!enrollment) {
        redirect("/dashboard?error=not-enrolled")
      }
    }
  }
  
  return (
    <div className="container py-8">
      <ExamTaker formId={formId} />
    </div>
  )
}