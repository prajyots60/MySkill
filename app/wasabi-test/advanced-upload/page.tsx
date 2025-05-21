'use client';

import { useState } from 'react';
import { NextGenWasabiUploader } from '@/components/next-gen-wasabi-uploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardTitle, CardDescription, CardHeader, CardContent, Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileVideo } from 'lucide-react';

export default function WasabiAdvancedTest() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Validate file is video
      const selectedFile = files[0];
      if (!selectedFile.type.startsWith('video/')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please select a video file',
          variant: 'destructive',
        });
        return;
      }
      
      setFile(selectedFile);
      if (!title) {
        // Set title based on filename without extension
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadComplete = (lectureId: string, fileKey: string) => {
    toast({
      title: 'Upload Successful',
      description: `Lecture ID: ${lectureId}`,
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Advanced Wasabi Upload Test</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Video Information</CardTitle>
            <CardDescription>
              Enter details for your video upload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Video File</Label>
              <Input
                id="file"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                id="isPreview"
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isPreview">
                Preview video (available without enrollment)
              </Label>
            </div>
          </CardContent>
        </Card>
        
        {file ? (
          <NextGenWasabiUploader
            sectionId="test-section-123"
            title={title}
            description={description}
            isPreview={isPreview}
            file={file}
            onUploadComplete={handleUploadComplete}
            onUploadError={(error) => {
              toast({
                title: 'Upload Error',
                description: error.message,
                variant: 'destructive',
              });
            }}
          />
        ) : (
          <Card className="border-dashed border-2 p-8 text-center">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileVideo className="h-12 w-12 mb-3" />
              <p>Select a video file to start the upload process</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
