"use client"

import { useState, useCallback, memo } from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, ChevronDown, ChevronUp, Edit } from "lucide-react"
import { LectureCard } from "@/components/lecture-card"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"
import type { Section } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  section: Section
  isExpanded: boolean
  isCreator: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

// Memoized section header component
const SectionHeader = memo(function SectionHeader({
  section,
  isExpanded,
  isCreator,
  onToggle,
  onEdit,
  onDelete,
}: SectionHeaderProps) {
  return (
    <CardHeader
      className={cn(
        "flex flex-row items-center justify-between space-y-0 cursor-pointer select-none",
        isCreator && "pr-2",
      )}
      onClick={onToggle}
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
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </CardHeader>
  )
})

// Memoized section edit form
const SectionEditForm = memo(function SectionEditForm({
  section,
  onSave,
  onCancel,
}: {
  section: Section
  onSave: (title: string, description: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(section.title)
  const [description, setDescription] = useState(section.description || "")

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Section Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(title, description)}>Save</Button>
      </div>
    </div>
  )
})

// Main virtualized section lectures component
export function VirtualizedSectionLectures({
  sections,
  isCreator,
  courseId,
  onAddLecture,
  onEditLecture,
  onDeleteSection,
  onEditSection,
}: {
  sections: Section[]
  isCreator: boolean
  courseId: string
  onAddLecture?: (sectionId: string) => void
  onEditLecture?: (lectureId: string) => void
  onDeleteSection?: (sectionId: string) => void
  onEditSection?: (sectionId: string, title: string, description: string) => Promise<boolean>
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    // Initialize all sections as expanded
    sections.reduce((acc, section) => ({ ...acc, [section.id]: true }), {}),
  )
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)

  // Parent container for virtualization
  const parentRef = useRef<HTMLDivElement>(null)

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }, [])

  // Handle section edit
  const handleEditSection = useCallback(
    async (sectionId: string, title: string, description: string) => {
      if (onEditSection) {
        const success = await onEditSection(sectionId, title, description)
        if (success) {
          setEditingSectionId(null)
        }
      }
    },
    [onEditSection],
  )

  // Create a flat list of items to virtualize (sections and their lectures)
  const items = sections.flatMap((section) => {
    const sectionItem = { type: "section", data: section }

    if (editingSectionId === section.id) {
      return [{ type: "section-edit", data: section }]
    }

    if (!expandedSections[section.id]) {
      return [sectionItem]
    }

    const lectureItems = section.lectures.map((lecture) => ({
      type: "lecture",
      data: lecture,
      sectionId: section.id,
    }))

    // Add "Add Lecture" button if creator
    if (isCreator) {
      lectureItems.push({
        type: "add-lecture",
        sectionId: section.id,
        data: {} as any, // Add empty data object to satisfy type requirements
      })
    }

    return [sectionItem, ...lectureItems]
  })

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = items[index]
      if (item.type === "section" || item.type === "section-edit") {
        return 100 // Estimated height for section headers
      } else if (item.type === "lecture") {
        return 300 // Estimated height for lecture cards
      } else {
        return 100 // Estimated height for "Add Lecture" button
      }
    },
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]

          return (
            <div
              key={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="p-1"
            >
              {item.type === "section" && (
                <Card>
                  <SectionHeader
                    section={item.data as Section}
                    isExpanded={expandedSections[item.data.id]}
                    isCreator={isCreator}
                    onToggle={() => toggleSection(item.data.id)}
                    onEdit={() => setEditingSectionId(item.data.id)}
                    onDelete={() => onDeleteSection?.(item.data.id)}
                  />
                </Card>
              )}

              {item.type === "section-edit" && (
                <Card>
                  <SectionEditForm
                    section={item.data as Section}
                    onSave={(title, description) => handleEditSection(item.data.id, title, description)}
                    onCancel={() => setEditingSectionId(null)}
                  />
                </Card>
              )}

              {item.type === "lecture" && (
                <div className="p-2">
                  <LectureCard
                    lecture={item.data as any}
                    isCreator={isCreator}
                    courseId={courseId}
                    onEdit={() => onEditLecture?.(item.data.id)}
                  />
                </div>
              )}

              {item.type === "add-lecture" && (
                <div className="p-2">
                  <Card className="flex flex-col items-center justify-center p-6 h-full">
                    <Button
                      variant="outline"
                      className="w-full h-full flex flex-col gap-4 hover:border-primary"
                      onClick={() => onAddLecture?.((item as { sectionId: string }).sectionId)}
                    >
                      <Plus className="h-8 w-8" />
                      <span>Add Lecture</span>
                    </Button>
                  </Card>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
