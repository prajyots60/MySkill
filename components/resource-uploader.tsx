"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { 
  FileIcon, 
  Upload, 
  File,
  FileType,
  FileText, 
  FileArchive, 
  FileImage, 
  FileCode, 
  FileSpreadsheet, 
  Presentation,
  Trash2,
  Download,
  Loader2
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ResourceUploaderProps {
  courseId?: string
  sectionId?: string
  lectureId?: string
  onUploadComplete?: (fileUrl: string, fileType: string, fileName: string) => void
  multiple?: boolean
  acceptedFileTypes?: string
}

export function ResourceUploader({
  courseId,
  sectionId,
  lectureId,
  onUploadComplete,
  multiple = false,
  acceptedFileTypes = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt"
}: ResourceUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: string;
  }>>([])

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Convert FileList to an array for easier handling
      const fileArray = Array.from(files)
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const formData = new FormData()
        formData.append('file', file)
        if (courseId) formData.append('courseId', courseId)
        if (sectionId) formData.append('sectionId', sectionId)
        if (lectureId) formData.append('lectureId', lectureId)

        // Upload the file
        const uploadResponse = await fetch('/api/content/upload-resource', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json()
          throw new Error(error.message || 'Failed to upload file')
        }

        const result = await uploadResponse.json()
        
        // Calculate progress
        const currentProgress = Math.round(((i + 1) / fileArray.length) * 100)
        setUploadProgress(currentProgress)
        
        // Add the uploaded file to our state
        setUploadedFiles(prev => [
          ...prev, 
          {
            id: result.fileId,
            name: file.name,
            url: result.fileUrl,
            type: file.type,
            size: formatFileSize(file.size)
          }
        ])
        
        // Call the callback with the file information
        if (onUploadComplete) {
          onUploadComplete(result.fileUrl, file.type, file.name)
        }
      }

      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${fileArray.length} ${fileArray.length === 1 ? 'file' : 'files'}`,
      })
      
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // Reset the input value so the same file can be uploaded again if needed
      event.target.value = ''
    }
  }, [courseId, sectionId, lectureId, onUploadComplete])

  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`/api/content/delete-resource/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete file')
      }

      setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
      
      toast({
        title: "File Deleted",
        description: "Successfully deleted the file",
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      })
    }
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileType className="h-6 w-6 text-red-500" />
    if (fileType.includes('word') || fileType.includes('doc')) return <FileText className="h-6 w-6 text-blue-500" />
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('xls')) 
      return <FileSpreadsheet className="h-6 w-6 text-green-500" />
    if (fileType.includes('presentation') || fileType.includes('powerpoint') || fileType.includes('ppt')) 
      return <Presentation className="h-6 w-6 text-orange-500" />
    if (fileType.includes('image')) return <FileImage className="h-6 w-6 text-purple-500" />
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) 
      return <FileArchive className="h-6 w-6 text-yellow-500" />
    if (fileType.includes('code') || fileType.includes('json') || fileType.includes('html') || fileType.includes('css')) 
      return <FileCode className="h-6 w-6 text-cyan-500" />
    return <FileIcon className="h-6 w-6 text-gray-500" />
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="resource-upload"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 border-muted-foreground/25 hover:bg-muted/50"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              {acceptedFileTypes.split(',').join(', ')} (Max 100MB)
            </p>
          </div>
          <input
            id="resource-upload"
            type="file"
            className="hidden"
            onChange={handleUpload}
            multiple={multiple}
            accept={acceptedFileTypes}
            disabled={isUploading}
          />
        </label>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm font-medium">Uploading files...</p>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Resources</h3>
          <div className="grid gap-2">
            {uploadedFiles.map((file) => (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteFile(file.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}