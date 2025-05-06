"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { HardDrive, Upload, FolderPlus, Loader2 } from "lucide-react"
import { useGDriveStore } from "@/lib/store/gdrive-store"

interface FileUploaderProps {
  onUploadComplete?: (fileData: any) => void
  onError?: (error: Error) => void
  folderId?: string
  className?: string
}

export default function GoogleDriveUploader({
  onUploadComplete,
  onError,
  folderId,
  className,
}: FileUploaderProps) {
  const { connected } = useGDriveStore()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connected) {
      toast({
        title: "Google Drive Not Connected",
        description: "Please connect your Google Drive account before uploading files",
        variant: "destructive",
      })
      return
    }

    const files = fileInputRef.current?.files
    if (!files || files.length === 0) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append("file", files[0])
      
      if (folderId) {
        formData.append("folderId", folderId)
      }

      setUploadProgress(30)

      const response = await fetch("/api/gdrive/files", {
        method: "POST",
        body: formData,
      })

      setUploadProgress(90)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to upload file")
      }

      const result = await response.json()
      
      setUploadProgress(100)
      
      if (result.success) {
        toast({
          title: "Upload Complete",
          description: "File has been uploaded to Google Drive successfully",
        })
        
        if (onUploadComplete) {
          onUploadComplete(result.file)
        }
        
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        throw new Error(result.message || "Failed to upload file")
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
      
      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCreateFolder = async () => {
    if (!connected) {
      toast({
        title: "Google Drive Not Connected",
        description: "Please connect your Google Drive account before creating folders",
        variant: "destructive",
      })
      return
    }

    const folderName = prompt("Enter folder name:")
    if (!folderName) return

    setIsUploading(true)

    try {
      const response = await fetch("/api/gdrive/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderName,
          parentFolderId: folderId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create folder")
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Folder Created",
          description: "Folder has been created in Google Drive successfully",
        })
        
        if (onUploadComplete) {
          onUploadComplete(result.folder)
        }
      } else {
        throw new Error(result.message || "Failed to create folder")
      }
    } catch (error) {
      console.error("Error creating folder:", error)
      toast({
        title: "Folder Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create folder",
        variant: "destructive",
      })
      
      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      setIsUploading(false)
    }
  }

  if (!connected) {
    return (
      <Card className={`border-dashed border-2 ${className}`}>
        <CardContent className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <HardDrive className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Google Drive Not Connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please connect your Google Drive account to upload files
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.location.href = "/dashboard/creator/service-connections"}
          >
            Connect Google Drive
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="border-dashed border-2">
        <CardContent className="p-4">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload File to Google Drive</Label>
              <Input 
                ref={fileInputRef} 
                id="file" 
                type="file" 
                disabled={isUploading}
              />
            </div>
            
            {isUploading && (
              <div className="w-full bg-secondary rounded-full h-2.5 mb-4">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
            
            <div className="flex flex-row gap-2">
              <Button 
                type="submit" 
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </>
                )}
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                onClick={handleCreateFolder}
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Folder
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}