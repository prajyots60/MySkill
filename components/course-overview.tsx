"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { TiptapEditor } from '@/components/tiptap'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Edit, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CourseOverviewProps {
  courseId: string
  isCreator: boolean
  initialContent?: string | null
  className?: string
}

export const CourseOverview = ({
  courseId,
  isCreator,
  initialContent,
  className,
}: CourseOverviewProps) => {
  const { data: session } = useSession()
  
  const [content, setContent] = useState<string>(initialContent || '')
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If we receive initial content from props, use it
    if (initialContent !== undefined) {
      setContent(initialContent || '')
    } else {
      // Otherwise, fetch content from API
      const fetchOverviewContent = async () => {
        try {
          setLoading(true)
          const response = await fetch(`/api/courses/${courseId}/overview`)
          
          if (response.ok) {
            const data = await response.json()
            if (data.content) {
              try {
                // Parse the JSON string if it's returned as a string
                const parsedContent = typeof data.content === 'string' 
                  ? JSON.parse(data.content) 
                  : data.content
                setContent(parsedContent || '')
              } catch (e) {
                // If parsing fails, use as-is
                setContent(data.content || '')
              }
            } else {
              setContent('')
            }
          }
        } catch (error) {
          console.error('Error fetching course overview content:', error)
          toast({
            title: 'Error',
            description: 'Failed to load course overview content',
            variant: 'destructive',
          })
        } finally {
          setLoading(false)
        }
      }
      
      fetchOverviewContent()
    }
  }, [courseId, initialContent])

  const handleSave = async () => {
    if (!session) return
    
    try {
      setSaving(true)
      
      const response = await fetch(`/api/courses/${courseId}/overview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })
      
      if (response.ok) {
        toast({
          title: 'Overview saved',
          description: 'Your course overview has been updated successfully.',
        })
        setEditMode(false)
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save overview')
      }
    } catch (error) {
      console.error('Error saving course overview:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save overview content',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Revert to original content if available
    if (initialContent !== undefined) {
      setContent(initialContent || '')
    }
    setEditMode(false)
  }

  // Placeholder content if there's nothing yet
  const emptyContent = `
    <div>
      <h1>Course Overview</h1>
      <p>This course has no overview content yet.</p>
      ${isCreator ? '<p>As the course creator, you can add detailed information about your course here.</p>' : ''}
    </div>
  `

  return (
    <Card className={cn("border shadow-md", className)}>
      <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-primary" />
            Course Overview
          </CardTitle>
          <CardDescription>
            {isCreator 
              ? "Provide comprehensive information about your course" 
              : "Detailed information about what you'll learn"}
          </CardDescription>
        </div>
        {isCreator && !editMode && (
          <Button 
            onClick={() => setEditMode(true)} 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Overview
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : editMode ? (
          <div className="space-y-4">
            <TiptapEditor
              content={content || emptyContent}
              onChange={setContent}
              placeholder="Describe your course in detail. Include what students will learn, prerequisites, and other important information..."
              className="min-h-[400px] bg-background"
              autoFocus={true}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: content || emptyContent
            }} 
          />
        )}
      </CardContent>
    </Card>
  )
}