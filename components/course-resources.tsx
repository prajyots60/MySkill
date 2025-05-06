"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import GDriveResourceUploader from "@/components/gdrive-resource-uploader"
import { 
  FileIcon, 
  FileType,
  FileText, 
  FileArchive, 
  FileImage, 
  FileCode, 
  FileSpreadsheet, 
  Presentation,
  Download,
  Loader2,
  FolderPlus,
  File,
  Trash2,
  AlertCircle,
  ExternalLink,
  HardDrive
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import { useSession } from "next-auth/react"

interface ResourcesDisplayProps {
  courseId?: string
  sectionId?: string
  lectureId?: string
  isCreator?: boolean
  title?: string
  description?: string
}

interface Resource {
  id: string
  name: string
  url: string
  fileId: string
  type: string
  size: string
  createdAt: string
}

export function CourseResources({ 
  courseId, 
  sectionId, 
  lectureId,
  isCreator = false, 
  title = "Resources",
  description = "Course materials and resources"
}: ResourcesDisplayProps) {
  const { data: session } = useSession()
  const { connected, checkConnectionStatus } = useGDriveStore()
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null)
  const [isConnectionChecked, setIsConnectionChecked] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Check Google Drive connection
  useEffect(() => {
    const checkGDriveConnection = async () => {
      if (isCreator) {
        await checkConnectionStatus()
      }
      setIsConnectionChecked(true)
    }
    
    checkGDriveConnection()
  }, [isCreator, checkConnectionStatus])

  // Fetch resources
  useEffect(() => {
    const fetchResources = async () => {
      if (!courseId) return
      
      setIsLoading(true)
      try {
        let endpoint = `/api/content/resources?courseId=${courseId}`
        if (sectionId) endpoint += `&sectionId=${sectionId}`
        if (lectureId) endpoint += `&lectureId=${lectureId}`
        
        const response = await fetch(endpoint)
        
        if (!response.ok) {
          console.log("Failed to load resources")
        }
        
        const data = await response.json()
        setResources(data.resources || [])
      } catch (error) {
        console.error('Error loading resources:', error)
        toast({
          title: "Error",
          description: "Failed to load resources",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchResources()
  }, [courseId, sectionId, lectureId])

  const handleUploadComplete = async () => {
    // Refresh resources after upload
    setIsUploadDialogOpen(false)
    
    if (!courseId) return
    
    setIsLoading(true)
    try {
      let endpoint = `/api/content/resources?courseId=${courseId}`
      if (sectionId) endpoint += `&sectionId=${sectionId}`
      if (lectureId) endpoint += `&lectureId=${lectureId}`
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error('Failed to load resources')
      }
      
      const data = await response.json()
      setResources(data.resources || [])
    } catch (error) {
      console.error('Error refreshing resources:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteResource = async () => {
    if (!resourceToDelete) return
    
    setIsDeleting(true)
    
    try {
      // First delete from database
      const response = await fetch(`/api/content/resources/${resourceToDelete.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete resource')
      }
      
      // Then try to delete from Google Drive if needed
      // Note: This is optional, as some educators might want to keep the file in Drive
      try {
        await fetch(`/api/gdrive/files/${resourceToDelete.fileId}`, {
          method: 'DELETE',
        })
      } catch (driveError) {
        console.error('Warning: File deleted from database but may still exist in Google Drive', driveError)
        // Don't throw here - we still consider the operation successful if DB record is removed
      }
      
      toast({
        title: "Resource Deleted",
        description: "Resource has been removed successfully"
      })
      
      // Update the resources list to remove the deleted item
      setResources(resources.filter(r => r.id !== resourceToDelete.id))
    } catch (error) {
      console.error('Error deleting resource:', error)
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete resource",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setResourceToDelete(null)
      setIsDeleting(false)
    }
  }

  const confirmDeleteResource = (resource: Resource) => {
    setResourceToDelete(resource)
    setDeleteDialogOpen(true)
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileType className="h-5 w-5 text-red-500" />
    if (fileType.includes('word') || fileType.includes('doc')) return <FileText className="h-5 w-5 text-blue-500" />
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('xls')) 
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    if (fileType.includes('presentation') || fileType.includes('powerpoint') || fileType.includes('ppt')) 
      return <Presentation className="h-5 w-5 text-orange-500" />
    if (fileType.includes('image')) return <FileImage className="h-5 w-5 text-purple-500" />
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) 
      return <FileArchive className="h-5 w-5 text-yellow-500" />
    if (fileType.includes('code') || fileType.includes('json') || fileType.includes('html') || fileType.includes('css')) 
      return <FileCode className="h-5 w-5 text-cyan-500" />
    return <FileIcon className="h-5 w-5 text-gray-500" />
  }
  
  // If the current user is a creator but not connected to GDrive
  const showConnectGDrive = isCreator && !connected && isConnectionChecked

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {isCreator && (
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={!connected && isConnectionChecked}>
                <FolderPlus className="h-4 w-4" />
                Add Resources
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Upload Resources</DialogTitle>
              </DialogHeader>
              <GDriveResourceUploader 
                courseId={courseId}
                sectionId={sectionId}
                lectureId={lectureId}
                multiple={true}
                onUploadComplete={handleUploadComplete}
              />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : showConnectGDrive ? (
          <Alert className="bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription>
              <div className="flex flex-col space-y-2">
                <span>Google Drive connection required to manage resources.</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-fit"
                  onClick={() => window.location.href = '/dashboard/creator/service-connections'}
                >
                  <HardDrive className="h-4 w-4 mr-2" />
                  Connect Google Drive
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : resources.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p>{isCreator ? "No resources uploaded yet. Click 'Add Resources' to upload." : "No resources available for this content."}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {resources.map((resource) => (
              <div key={resource.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(resource.type)}
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">{resource.size}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" asChild title="Download/View">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  
                  {isCreator && (
                    <AlertDialog open={deleteDialogOpen && resourceToDelete?.id === resource.id} onOpenChange={(open) => {
                      if (!open) {
                        setDeleteDialogOpen(false)
                        setResourceToDelete(null)
                      }
                    }}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          title="Delete resource"
                          onClick={() => confirmDeleteResource(resource)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{resource.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={(e) => {
                              e.preventDefault() 
                              handleDeleteResource()
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Add default export for Next.js dynamic import
export default CourseResources;
