"use client"

import { useState, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Plus, Trash2, ChevronDown, ChevronUp, Edit, Loader2 } from "lucide-react"
import { LectureCard } from "@/components/lecture-card"
import type { Section } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

interface SectionLecturesProps {
  section: Section
  courseId: string
  isEnrolled?: boolean
  isFreeCourse?: boolean
  onAddLecture?: (sectionId: string) => void
  onEditLecture?: (lectureId: string) => void
  onDeleteLecture?: (lectureId: string) => void
  onDeleteSection?: (sectionId: string, title: string) => void
  onEditSection?: (sectionId: string, title: string, description: string) => Promise<boolean>
  showEditControls?: boolean
}

export function SectionLectures({
  section,
  courseId,
  isEnrolled = false,
  isFreeCourse = false,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onDeleteSection,
  onEditSection,
  showEditControls = false,
}: SectionLecturesProps) {
  const pathname = usePathname()
  const isCreatorDashboard = pathname?.startsWith("/dashboard/creator")
  const isCreator = showEditControls || isCreatorDashboard
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(section.title)
  const [editDescription, setEditDescription] = useState(section.description || "")
  const [isSaving, setIsSaving] = useState(false)

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!onEditSection) return

    setIsSaving(true)
    try {
      const success = await onEditSection(section.id, editTitle, editDescription)
      if (success) {
        setIsEditing(false)
      }
    } catch (error) {
      console.error("Failed to save section:", error)
    } finally {
      setIsSaving(false)
    }
  }, [section.id, editTitle, editDescription, onEditSection])

  const handleCancel = useCallback(() => {
    setEditTitle(section.title)
    setEditDescription(section.description || "")
    setIsEditing(false)
  }, [section.title, section.description])

  return (
    <Card>
      {isEditing ? (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Section Title</Label>
            <Input id="title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between space-y-0 cursor-pointer select-none",
            isCreator && "pr-2",
          )}
          onClick={toggleExpanded}
        >
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              {section.title}
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
          {isCreator && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={handleEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              {onDeleteSection && (
                <Button variant="ghost" size="icon" onClick={() => onDeleteSection(section.id, section.title)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardHeader>
      )}
      {isExpanded && !isEditing && (
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.lectures?.map((lecture) => (
              <LectureCard
                key={lecture.id}
                courseId={courseId}
                lecture={lecture}
                isEnrolled={isEnrolled}
                isFreeCourse={isFreeCourse}
                onEdit={isCreator ? () => onEditLecture?.(lecture.id) : undefined}
                onDelete={isCreator ? () => onDeleteLecture?.(lecture.id) : undefined}
                isCreator={isCreator}
              />
            ))}
            {isCreator && (
              <Card className="flex flex-col items-center justify-center p-6 h-full">
                <Button
                  variant="outline"
                  className="w-full h-full flex flex-col gap-4 hover:border-primary"
                  onClick={() => onAddLecture?.(section.id)}
                >
                  <Plus className="h-8 w-8" />
                  <span>Add Lecture</span>
                </Button>
              </Card>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export const MemoizedSectionLectures = memo(SectionLectures)
