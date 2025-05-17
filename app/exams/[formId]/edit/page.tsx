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
    <div className="container py-10 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-purple-50/20 to-indigo-50/10 dark:from-indigo-950/10 dark:via-purple-950/5 dark:to-indigo-950/10 -z-10 pointer-events-none"></div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">Edit Exam</h1>
        <p className="text-muted-foreground mt-1">Customize your exam and add questions</p>
      </div>
      <ExamCreator formId={formId} defaultTab="questions" />
    </div>
  )
}