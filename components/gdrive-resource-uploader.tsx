"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Loader2,
  HardDrive,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import GoogleDriveFilePicker from "@/components/google-drive-file-picker"

interface GDriveResourceUploaderProps {
  courseId?: string
  sectionId?: string
  lectureId?: string
  onUploadComplete?: (fileData: any) => void
  onError?: (error: Error) => void
  multiple?: boolean
  acceptedFileTypes?: string
}

export function GDriveResourceUploader({
  courseId,
  sectionId,
  lectureId,
  onUploadComplete,
  onError,
  multiple = false,
  acceptedFileTypes = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt"
}: GDriveResourceUploaderProps) {
  const { connected, checkConnectionStatus } = useGDriveStore()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [connectionChecked, setConnectionChecked] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check Google Drive connection when component mounts
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true)
      await checkConnectionStatus()
      setConnectionChecked(true)
      setIsCheckingConnection(false)
    }
    
    checkConnection()
  }, [checkConnectionStatus])

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

        // First, upload to Google Drive
        setUploadProgress(10)
        const gdriveResponse = await fetch('/api/gdrive/files', {
          method: 'POST',
          body: formData,
        })

        if (!gdriveResponse.ok) {
          const error = await gdriveResponse.json()
          throw new Error(error.message || 'Failed to upload file to Google Drive')
        }

        setUploadProgress(50)
        const gdriveResult = await gdriveResponse.json()
        
        if (!gdriveResult.success) {
          throw new Error(gdriveResult.message || 'Failed to upload file to Google Drive')
        }

        setUploadProgress(60)
        
        try {
          // Now register the resource in our database using a direct fetch to bypass Prisma issues
          const resourceData = {
            courseId,
            sectionId,
            lectureId,
            fileId: gdriveResult.file.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: gdriveResult.file.webViewLink || gdriveResult.file.webContentLink
          }

          setUploadProgress(70)
          const resourceResponse = await fetch('/api/content/resources', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resourceData),
          })

          setUploadProgress(90)
          
          if (!resourceResponse.ok) {
            console.warn('Failed to register resource in database, but file was uploaded to Drive:', gdriveResult.file);
            // Don't throw error - we'll consider this a partial success
            // since the file was uploaded to Google Drive successfully
            
            // Call the callback with the Google Drive file information directly
            if (onUploadComplete) {
              onUploadComplete({
                id: gdriveResult.file.id, // Use the Google Drive file ID as fallback
                name: file.name,
                type: file.type,
                size: formatFileSize(file.size),
                url: gdriveResult.file.webViewLink || gdriveResult.file.webContentLink,
                fileId: gdriveResult.file.id,
                createdAt: new Date().toISOString()
              })
            }
          } else {
            const result = await resourceResponse.json()
            // Calculate progress
            const currentProgress = Math.round(((i + 1) / fileArray.length) * 100)
            setUploadProgress(currentProgress)
            
            // Call the callback with the file information
            if (onUploadComplete) {
              onUploadComplete(result.resource)
            }
          }
        } catch (dbError) {
          console.warn('Error registering resource in database, but file was uploaded to Drive:', dbError);
          // Don't throw error - we'll consider this a partial success
          // since the file was uploaded to Google Drive successfully
          
          // Call the callback with the Google Drive file information directly
          if (onUploadComplete) {
            onUploadComplete({
              id: gdriveResult.file.id, // Use the Google Drive file ID as fallback
              name: file.name,
              type: file.type,
              size: formatFileSize(file.size),
              url: gdriveResult.file.webViewLink || gdriveResult.file.webContentLink,
              fileId: gdriveResult.file.id,
              createdAt: new Date().toISOString()
            })
          }
        }
      }

      toast({
        title: "Upload Complete",
        description: `Files uploaded to Google Drive successfully${!courseId ? '. Note: Some metadata may not have been saved to the database.' : ''}`,
      })
      
    } catch (error) {
      console.error('Upload error:', error)
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
      // Reset the input value so the same file can be uploaded again if needed
      event.target.value = ''
    }
  }

  const handleGDriveFileSelect = async (file: any) => {
    setIsUploading(true)
    setUploadProgress(10)

    try {
      // Register the Google Drive file in our database
      const resourceData = {
        courseId,
        sectionId,
        lectureId,
        fileId: file.id,
        fileName: file.name,
        fileType: file.mimeType,
        fileSize: parseInt(file.size || '0'),
        fileUrl: file.webViewLink || file.webContentLink
      }

      setUploadProgress(50)

      const resourceResponse = await fetch('/api/content/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceData),
      })

      setUploadProgress(90)

      if (!resourceResponse.ok) {
        const error = await resourceResponse.json()
        throw new Error(error.message || 'Failed to register resource')
      }

      const result = await resourceResponse.json()
      
      setUploadProgress(100)

      toast({
        title: "Resource Added",
        description: `Successfully added "${file.name}" as a resource`,
      })
      
      // Call the callback with the file information
      if (onUploadComplete) {
        onUploadComplete(result.resource)
      }
    } catch (error) {
      console.error('Resource registration error:', error)
      toast({
        title: "Failed to Add Resource",
        description: error instanceof Error ? error.message : "Failed to add Google Drive file as a resource",
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

  // If still checking connection, show loading state
  if (isCheckingConnection) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Checking Google Drive connection...</span>
      </div>
    )
  }

  // If not connected, show connection required message
  if (!connected && connectionChecked) {
    return (
      <Alert className="bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertDescription>
          <div className="flex flex-col space-y-2">
            <span>Google Drive connection required to upload resources.</span>
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
    )
  }

  // Normal upload UI when connected
  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="flex-1">
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
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>
        
        <div className="flex flex-col justify-center">
          <GoogleDriveFilePicker
            onFileSelect={handleGDriveFileSelect}
            buttonLabel="Select from Google Drive"
            dialogTitle="Select a file from your Google Drive"
            fileTypes={acceptedFileTypes.split(',').map(type => type.replace('.', ''))}
            className="h-32 w-full"
          />
        </div>
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

      {connected && (
        <Alert className="bg-green-100 border-green-300 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertDescription>
            Your Google Drive is connected. Files will be stored in your Google Drive account.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default GDriveResourceUploader;