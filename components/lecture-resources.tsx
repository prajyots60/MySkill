import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import CourseResources from "@/components/course-resources"

interface LectureResourcesProps {
  courseId: string
  sectionId: string
  lectureId: string
  isCreator: boolean
}

export default function LectureResources({ courseId, sectionId, lectureId, isCreator }: LectureResourcesProps) {
  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Lecture Resources</CardTitle>
        <CardDescription>
          {isCreator 
            ? "Manage resources attached to this lecture" 
            : "Materials specific to this lecture"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CourseResources
          courseId={courseId}
          sectionId={sectionId}
          lectureId={lectureId}
          isCreator={isCreator}
          title="Lecture Materials"
          description="Resources for this specific lecture"
        />
      </CardContent>
    </Card>
  )
}