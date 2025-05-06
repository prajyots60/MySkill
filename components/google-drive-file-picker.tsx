"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
  Search, 
  Loader2,
  Check
} from "lucide-react"
import { formatBytes, formatDate } from "@/lib/utils/format"

interface GoogleDriveFilePickerProps {
  onFileSelect: (file: any) => void
  buttonLabel?: string
  dialogTitle?: string
  fileTypes?: string[]
  className?: string
}

export default function GoogleDriveFilePicker({
  onFileSelect,
  buttonLabel = "Select from Google Drive",
  dialogTitle = "Select a file from Google Drive",
  fileTypes,
  className,
}: GoogleDriveFilePickerProps) {
  const { connected } = useGDriveStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined)
  const [folderPath, setFolderPath] = useState<{ id: string, name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<any>(null)

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
        let sortedFiles = data.files.sort((a: any, b: any) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder'
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder'
          
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          
          return a.name.localeCompare(b.name)
        })

        // Filter by file type if specified
        if (fileTypes && fileTypes.length > 0) {
          sortedFiles = sortedFiles.filter(file => 
            file.mimeType === 'application/vnd.google-apps.folder' || 
            fileTypes.some(type => file.mimeType.includes(type))
          )
        }
        
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

  // Handle dialog open
  const handleDialogOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      loadFiles(currentFolderId)
    } else {
      // Reset state when dialog is closed
      setSelectedFile(null)
    }
  }

  // Handle folder navigation
  const handleFolderOpen = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId)
    setFolderPath([...folderPath, { id: folderId, name: folderName }])
    loadFiles(folderId)
  }

  // Navigate to a specific folder in the path
  const navigateToFolder = (index: number) => {
    if (index < 0) {
      // Navigate to root
      setCurrentFolderId(undefined)
      setFolderPath([])
      loadFiles(undefined)
      return
    }
    
    // Navigate to specific folder in path
    const newPath = folderPath.slice(0, index + 1)
    setFolderPath(newPath)
    setCurrentFolderId(newPath[newPath.length - 1].id)
    loadFiles(newPath[newPath.length - 1].id)
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
      loadFiles(undefined)
    } else {
      // Go to parent folder
      const newPath = folderPath.slice(0, -1)
      setFolderPath(newPath)
      setCurrentFolderId(newPath[newPath.length - 1].id)
      loadFiles(newPath[newPath.length - 1].id)
    }
  }

  // Handle file selection
  const handleFileSelect = (file: any) => {
    setSelectedFile(file)
  }

  // Handle file pick confirmation
  const handleConfirmSelection = () => {
    if (selectedFile) {
      onFileSelect(selectedFile)
      setOpen(false)
    } else {
      toast({
        title: "No File Selected",
        description: "Please select a file to continue",
        variant: "destructive",
      })
    }
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
        let sortedFiles = data.files.sort((a: any, b: any) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder'
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder'
          
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          
          return a.name.localeCompare(b.name)
        })

        // Filter by file type if specified
        if (fileTypes && fileTypes.length > 0) {
          sortedFiles = sortedFiles.filter(file => 
            file.mimeType === 'application/vnd.google-apps.folder' || 
            fileTypes.some(type => file.mimeType.includes(type))
          )
        }
        
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
      <Button
        variant="outline"
        className={className}
        onClick={() => window.location.href = "/dashboard/creator/service-connections"}
      >
        Connect to Google Drive
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <HardDrive className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigateToFolder(-1)}>
                Root
              </Button>
              
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center">
                  <span>/</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto"
                    onClick={() => navigateToFolder(index)}
                  >
                    {folder.name}
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
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
          
          <div className="flex-1 overflow-auto border rounded-md">
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
                    : "This folder is empty or no files match the allowed types."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
                    const isSelected = selectedFile?.id === file.id
                    
                    return (
                      <TableRow 
                        key={file.id}
                        className={isSelected ? 'bg-primary/5' : undefined}
                        onClick={() => isFolder ? handleFolderOpen(file.id, file.name) : handleFileSelect(file)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {!isFolder && isSelected && (
                            <div className="flex items-center justify-center">
                              <Check className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isFolder ? (
                              <Folder className="h-5 w-5 text-blue-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-gray-500" />
                            )}
                            <span className="text-sm">{file.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{file.size ? formatBytes(parseInt(file.size)) : 'N/A'}</TableCell>
                        <TableCell>{formatDate(new Date(file.createdTime))}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        
        <div className="flex justify-end mt-4 gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmSelection} 
            disabled={!selectedFile}
          >
            Select File
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}