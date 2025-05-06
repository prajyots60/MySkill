import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExamResults from "@/components/exam-results"
import * as examService from "@/lib/server/exams"

interface ExamResultsPageProps {
  params: {
    formId: string
  }
}

export const metadata: Metadata = {
  title: "Exam Results",
  description: "View and grade exam results",
}

export default async function ExamResultsPage({ params }: ExamResultsPageProps) {
  const session = await getServerSession(authOptions)
  
  // Only creators and admins can view results
  if (!session?.user || !["CREATOR", "ADMIN"].includes(session.user.role)) {
    redirect("/dashboard")
  }
  
  const { formId } = await params
  
  try {
    // Get the exam to make sure it exists and to get its ID
    const exam = await examService.getExamByFormId(formId)
    
    return (
      <div className="container py-8">
        <ExamResults examId={exam.id} />
      </div>
    )
  } catch (error) {
    // If the exam doesn't exist, redirect to dashboard
    redirect("/dashboard")
  }
}