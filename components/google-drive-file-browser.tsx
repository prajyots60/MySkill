"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import { Input } from "@/components/ui/input"
import { 
  HardDrive, 
  FileText, 
  Folder, 
  RefreshCw, 
  ArrowLeft, 
  Download, 
  Trash2, 
  Search, 
  Loader2
} from "lucide-react"
import { formatBytes, formatDate } from "@/lib/utils/format"
import GoogleDriveUploader from "@/components/google-drive-uploader"

interface GoogleDriveFileBrowserProps {
  initialFolderId?: string
  onFileSelect?: (file: any) => void
  className?: string
  showUploader?: boolean
}

export default function GoogleDriveFileBrowser({
  initialFolderId,
  onFileSelect,
  className,
  showUploader = true,
}: GoogleDriveFileBrowserProps) {
  const { connected } = useGDriveStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(initialFolderId)
  const [folderPath, setFolderPath] = useState<{ id: string, name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)

  // Initial file loading
  useEffect(() => {
    if (connected) {
      loadFiles(currentFolderId)
    }
  }, [connected, currentFolderId])

  // Load files from the API
  const loadFiles = async (folderId?: string) => {
    if (!connected) return
    
    setLoading(true)
    try {
      let url = `/api/gdrive/files?pageSize=100`
      if (folderId) {
        url += `&folderId=${folderId}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error("Failed to load files")
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Sort folders first, then by name
        const sortedFiles = data.files.sort((a: any, b: any) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder'
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder'
          
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          
          return a.name.localeCompare(b.name)
        })
        
        setFiles(sortedFiles)
      } else {
        throw new Error(data.message || "Failed to load files")
      }
    } catch (error) {
      console.error("Error loading files:", error)
      toast({
        title: "Error Loading Files",
        description: error instanceof Error ? error.message : "Failed to load files",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle folder navigation
  const handleFolderOpen = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId)
    setFolderPath([...folderPath, { id: folderId, name: folderName }])
  }

  // Navigate to a specific folder in the path
  const navigateToFolder = (index: number) => {
    if (index < 0) {
      // Navigate to root
      setCurrentFolderId(undefined)
      setFolderPath([])
      return
    }
    
    // Navigate to specific folder in path
    const newPath = folderPath.slice(0, index + 1)
    setFolderPath(newPath)
    setCurrentFolderId(newPath[newPath.length - 1].id)
  }

  // Handle navigating up one level
  const handleGoBack = () => {
    if (folderPath.length === 0) {
      return
    }
    
    if (folderPath.length === 1) {
      // Go to root
      setCurrentFolderId(undefined)
      setFolderPath([])
    } else {
      // Go to parent folder
      const newPath = folderPath.slice(0, -1)
      setFolderPath(newPath)
      setCurrentFolderId(newPath[newPath.length - 1].id)
    }
  }

  // Handle file download
  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      // Trigger download by creating a link to the file download endpoint
      const a = document.createElement('a')
      a.href = `/api/gdrive/files/${fileId}/download`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading file:", error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive",
      })
    }
  }

  // Handle file deletion
  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/gdrive/files/${fileId}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete file")
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "File Deleted",
          description: `"${fileName}" has been deleted successfully`,
        })
        
        // Refresh the file list
        loadFiles(currentFolderId)
      } else {
        throw new Error(result.message || "Failed to delete file")
      }
    } catch (error) {
      console.error("Error deleting file:", error)
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      })
    }
  }

  // Handle file upload completion
  const handleUploadComplete = () => {
    // Refresh the file list
    loadFiles(currentFolderId)
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // If search is empty, just load the current folder
      loadFiles(currentFolderId)
      return
    }
    
    setSearchLoading(true)
    try {
      let url = `/api/gdrive/files?query=${encodeURIComponent(searchQuery)}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error("Failed to search files")
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Sort folders first, then by name
        const sortedFiles = data.files.sort((a: any, b: any) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder'
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder'
          
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          
          return a.name.localeCompare(b.name)
        })
        
        setFiles(sortedFiles)
      } else {
        throw new Error(data.message || "Failed to search files")
      }
    } catch (error) {
      console.error("Error searching files:", error)
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to search files",
        variant: "destructive",
      })
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle key press for search
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  if (!connected) {
    return (
      <Card className={`${className}`}>
        <CardContent className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <HardDrive className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Google Drive Not Connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please connect your Google Drive account to browse files
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
      {showUploader && (
        <GoogleDriveUploader 
          folderId={currentFolderId} 
          onUploadComplete={handleUploadComplete} 
        />
      )}
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Google Drive Files</CardTitle>
              <CardDescription>
                Browse and manage your Google Drive files
              </CardDescription>
            </div>
            
            <div className="flex flex-row items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-full sm:w-[200px] pr-8"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full w-10"
                  onClick={handleSearch}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <Button
                size="icon"
                variant="outline"
                onClick={() => loadFiles(currentFolderId)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              {folderPath.length > 0 && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleGoBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Folder path navigation */}
          {folderPath.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-2 text-sm text-muted-foreground">
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigateToFolder(-1)}>
                Root
              </Button>
              <span>/</span>
              
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto"
                    onClick={() => navigateToFolder(index)}
                  >
                    {folder.name}
                  </Button>
                  {index < folderPath.length - 1 && <span>/</span>}
                </div>
              ))}
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <FileText className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No files found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery 
                  ? "No files match your search query" 
                  : "This folder is empty. Upload files or create a folder."}
              </p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
                    return (
                      <TableRow key={file.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isFolder ? (
                              <Folder className="h-5 w-5 text-blue-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-gray-500" />
                            )}
                            {isFolder ? (
                              <Button
                                variant="link"
                                className="p-0 h-auto text-left font-normal"
                                onClick={() => handleFolderOpen(file.id, file.name)}
                              >
                                {file.name}
                              </Button>
                            ) : (
                              <span className="text-sm">{file.name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{file.size ? formatBytes(parseInt(file.size)) : 'N/A'}</TableCell>
                        <TableCell>{formatDate(new Date(file.createdTime))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!isFolder && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDownload(file.id, file.name)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(file.id, file.name)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}