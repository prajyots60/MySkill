'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExclamationTriangleIcon, FileIcon, FileTextIcon, ImageIcon, VideoIcon } from '@radix-ui/react-icons';
import { formatDistanceToNow } from 'date-fns';

interface CourseResourceManagerProps {
  courseId: string;
  courseTitle: string;
  isCreator: boolean;
}

interface Resource {
  id: string;
  title: string;
  type: string;
  storagePath: string;
  url: string;
  sizeInBytes: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  metadata: Record<string, any>;
}

export default function CourseResourceManager({
  courseId,
  courseTitle,
  isCreator,
}: CourseResourceManagerProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { uploadFile, deleteFile, getFileUrl, isUploading, uploadProgress } = useWasabiStorage();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('resources');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch resources on load and when category changes
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const fetchResources = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/courses/${courseId}/resources?category=${activeCategory}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to fetch resources');
        }
        
        const data = await response.json();
        setResources(data.resources);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resources');
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResources();
  }, [courseId, activeCategory, session]);
  
  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !session?.user?.id) return;
    
    setError(null);
    const file = e.target.files[0];
    
    // Begin upload
    const result = await uploadFile({
      file,
      category: `courses/${courseId}/${activeCategory}`,
      metadata: {
        courseId,
        courseTitle,
        uploadedBy: session.user.id,
        category: activeCategory,
      },
      onProgress: (progress) => console.log(`Upload progress: ${progress}%`),
      usePresignedUrl: false, // Use server-side upload for course resources
    });
    
    if (result.success && result.key) {
      // Refresh the resource list
      router.refresh();
      
      // Optimistically update the UI
      const newResource: Resource = {
        id: Math.random().toString(36).substring(2, 10), // Temporary ID
        title: file.name,
        type: file.type,
        storagePath: result.key,
        url: result.url || '',
        sizeInBytes: file.size,
        createdAt: new Date().toISOString(),
        uploadedBy: {
          id: session.user.id,
          name: session.user.name || 'User',
        },
        metadata: {
          courseId,
          courseTitle,
          uploadedBy: session.user.id,
          category: activeCategory,
        },
      };
      
      setResources(prev => [newResource, ...prev]);
    } else {
      setError(result.error || 'Upload failed');
    }
    
    // Clear the input
    e.target.value = '';
  };
  
  // Handle resource deletion
  const handleDeleteResource = async (resourceId: string) => {
    if (!session?.user?.id || !isCreator) return;
    
    try {
      const response = await fetch(`/api/courses/${courseId}/resources/${resourceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete resource');
      }
      
      // Update the UI
      setResources(prev => prev.filter(r => r.id !== resourceId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resource');
    }
  };
  
  // Handle resource download
  const handleDownloadResource = async (resourceId: string) => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch(`/api/courses/${courseId}/resources/${resourceId}/url`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to get download URL');
      }
      
      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download resource');
    }
  };
  
  // Filter resources based on search term
  const filteredResources = searchTerm
    ? resources.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : resources;
  
  // Get appropriate icon based on file type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5" />;
    if (type.startsWith('video/')) return <VideoIcon className="h-5 w-5" />;
    if (type.startsWith('text/') || type.includes('document')) return <FileTextIcon className="h-5 w-5" />;
    return <FileIcon className="h-5 w-5" />;
  };
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Resources</CardTitle>
          <CardDescription>
            Manage resources for {courseTitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="resources" value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-4">
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="lectures">Lecture Materials</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
            
            {isCreator && (
              <div className="mb-6 p-4 border rounded-md">
                <h3 className="text-sm font-medium mb-2">Upload New {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</h3>
                <Input
                  type="file"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="mb-2"
                />
                
                {isUploading && (
                  <div className="mt-2">
                    <Progress value={uploadProgress} className="mb-1" />
                    <p className="text-xs text-center">Uploading... {uploadProgress}%</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="mb-4">
              <Label htmlFor="search">Search Resources</Label>
              <Input
                id="search"
                placeholder="Search by filename or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center p-8">
                  <p>Loading resources...</p>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="text-center p-8 border rounded-md">
                  <p className="text-muted-foreground">No {activeCategory} found</p>
                  {isCreator && (
                    <p className="text-sm mt-2">Upload your first file above</p>
                  )}
                </div>
              ) : (
                filteredResources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between p-4 border rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary rounded-md">
                        {getFileIcon(resource.type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">{resource.title}</h4>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(resource.sizeInBytes)}</span>
                          <span>•</span>
                          <span>Uploaded {formatDistanceToNow(new Date(resource.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadResource(resource.id)}
                      >
                        Download
                      </Button>
                      
                      {isCreator && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteResource(resource.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
