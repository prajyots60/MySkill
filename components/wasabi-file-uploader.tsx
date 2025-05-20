'use client';

import { useState, useRef } from 'react';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircledIcon, CrossCircledIcon, FileIcon } from '@radix-ui/react-icons';

interface WasabiFileUploaderProps {
  category: string;
  allowedFileTypes?: string[];
  maxSizeMB?: number;
  usePresignedUrl?: boolean;
  metadata?: Record<string, string>;
  onUploadComplete?: (fileData: {
    url: string;
    key: string;
    filename: string;
    fileType: string;
    fileSize: number;
  }) => void;
  buttonText?: string;
  className?: string;
}

export default function WasabiFileUploader({
  category,
  allowedFileTypes,
  maxSizeMB = 50, // Default 50MB max
  usePresignedUrl = true,
  metadata = {},
  onUploadComplete,
  buttonText = 'Select File',
  className = '',
}: WasabiFileUploaderProps) {
  const { uploadFile, isUploading, uploadProgress } = useWasabiStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [uploadedFileData, setUploadedFileData] = useState<{
    url: string;
    key: string;
    filename: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  // Reset states when selecting a new file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const file = e.target.files[0];
    
    // Validate file type if allowedFileTypes is provided
    if (allowedFileTypes && allowedFileTypes.length > 0) {
      if (!allowedFileTypes.includes(file.type)) {
        setError(`File type not allowed. Please upload ${allowedFileTypes.join(', ')}`);
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
    }
    
    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB`);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    setSuccess(false);
    setUploadedFileData(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }
    
    setError(null);
    setSuccess(false);
    
    try {
      const result = await uploadFile({
        file: selectedFile,
        category,
        metadata,
        usePresignedUrl,
        onProgress: (progress) => console.log(`Upload progress: ${progress}%`),
      });
      
      if (result.success && result.url && result.key) {
        setSuccess(true);
        const fileData = {
          url: result.url,
          key: result.key,
          filename: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        };
        
        setUploadedFileData(fileData);
        
        if (onUploadComplete) {
          onUploadComplete(fileData);
        }
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFile(null);
      } else {
        console.error('Upload failed with result:', result);
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error in handleUpload:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label htmlFor="file-upload">Upload File</Label>
        <Input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          disabled={isUploading}
          className="cursor-pointer"
        />
        {selectedFile && (
          <div className="text-sm flex items-center space-x-2 mt-2">
            <FileIcon className="h-4 w-4" />
            <span className="font-medium">{selectedFile.name}</span>
            <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
          </div>
        )}
        {allowedFileTypes && allowedFileTypes.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Allowed file types: {allowedFileTypes.join(', ')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Maximum file size: {maxSizeMB}MB
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <CrossCircledIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && uploadedFileData && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircledIcon className="h-4 w-4 text-green-600" />
          <AlertDescription>
            File uploaded successfully!
          </AlertDescription>
        </Alert>
      )}
      
      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-xs text-center">{uploadProgress}% uploaded</p>
        </div>
      )}
      
      <Button 
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full"
      >
        {isUploading ? 'Uploading...' : buttonText}
      </Button>
    </div>
  );
}