'use client';

import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function VideoDirectUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setUploadProgress(0); // Reset progress on new file selection
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a video file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get a presigned URL from your API route
      const getSignedUrlResponse = await fetch('/api/wasabi-presigned-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type,
        }),
      });

      if (!getSignedUrlResponse.ok) {
        const errorData = await getSignedUrlResponse.json();
        throw new Error(errorData.message || "Failed to get presigned URL");
      }

      const { url, key } = await getSignedUrlResponse.json();

      // 2. Upload the file directly to Wasabi using the presigned URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
        // Add upload progress tracking (optional but good UX)
        // This part requires careful implementation depending on your environment/libraries
        // For a simple fetch, progress tracking is not built-in. 
        // You might use a library like axios for easier progress tracking.
      });

      if (!uploadResponse.ok) {
         // Attempt to read error response from Wasabi
         const errorText = await uploadResponse.text();
         console.error("Wasabi direct upload failed response text:", errorText);
         throw new Error(`Direct upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. Response: ${errorText.substring(0, 200)}...`);
      }

      toast({
        title: "Upload successful!",
        description: `Video uploaded with key: ${key}`,
        variant: "default",
      });

      // Reset form
      setSelectedFile(null);
      setUploadProgress(0);

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Dummy progress update for demonstration (replace with actual tracking if using axios or similar)
  useEffect(() => {
    if (isUploading) {
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 95) return prev + 5;
          return prev;
        });
      }, 500);
      return () => clearInterval(interval);
    } else if (uploadProgress === 100) {
       // Progress is 100, clear interval logic handled by isUploading changing
    }
  }, [isUploading, uploadProgress]);
  
  // Reset progress when upload finishes
  useEffect(() => {
      if (!isUploading && uploadProgress > 0 && uploadProgress < 100) {
          setUploadProgress(0);
      }
  }, [isUploading, uploadProgress]);


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
        <CardDescription>Select a video file to upload directly to Wasabi.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="video-file">Choose Video File</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/*" // Accept all video types
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024 / 1024)} MB)</p>
            )}
          </div>

          {isUploading && (
            <div className="grid gap-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!selectedFile || isUploading}>
            {isUploading ? 'Uploading...' : 'Upload Video'}
          </Button>
        </form>
        {/* Add a ToastProvider component somewhere in your app layout if not already present */}
        {/* <ToastProvider /> */}
      </CardContent>
    </Card>
  );
}

// Note: Real upload progress tracking with `fetch` is complex.
// For better progress reporting, consider using libraries like `axios`
// or the AWS SDK client-s3 browser upload capabilities. 