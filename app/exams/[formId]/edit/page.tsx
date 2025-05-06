import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExamCreator from "@/components/exam-creator"

interface ExamEditPageProps {
  params: {
    formId: string
  }
}

export const metadata: Metadata = {
  title: "Edit Exam",
  description: "Create or edit an exam",
}

export default async function ExamEditPage({ params }: ExamEditPageProps) {
  const session = await getServerSession(authOptions)
  
  // Only creators and admins can edit exams
  if (!session?.user || !["CREATOR", "ADMIN"].includes(session.user.role)) {
    redirect("/dashboard")
  }
  
  const { formId } = await params
  
  return (
    <div className="container py-8">
      <ExamCreator formId={formId} />
    </div>
  )
}