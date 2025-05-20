'use client';

import { useState } from 'react';
import WasabiFileUploader from '@/components/wasabi-file-uploader';
import WasabiConfigChecker from '@/components/wasabi-config-checker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WasabiStorageDemo() {
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    url: string;
    key: string;
    filename: string;
    fileType: string;
    fileSize: number;
  }>>([]);

  const handleUploadComplete = (fileData: {
    url: string;
    key: string;
    filename: string;
    fileType: string;
    fileSize: number;
  }) => {
    setUploadedFiles((prev) => [...prev, fileData]);
  };

  const handleDeleteFile = async (key: string) => {
    try {
      const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      });

      if (response.ok) {
        setUploadedFiles((prev) => prev.filter(file => file.key !== key));
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const handleGetPresignedUrl = async (key: string) => {
    try {
      const response = await fetch('/api/storage/get-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to get file URL');
      }
    } catch (error) {
      console.error('Error getting file URL:', error);
      alert('Failed to get file URL. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Wasabi Storage Integration Demo</h1>

      <WasabiConfigChecker />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Files to Wasabi</CardTitle>
            <CardDescription>
              Upload files directly to Wasabi cloud storage using presigned URLs or server-side upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="documents">
              <TabsList className="mb-4">
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="documents">
                <WasabiFileUploader
                  category="documents"
                  allowedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv']}
                  maxSizeMB={10}
                  onUploadComplete={handleUploadComplete}
                  metadata={{ type: 'document', purpose: 'educational' }}
                />
              </TabsContent>
              
              <TabsContent value="images">
                <WasabiFileUploader
                  category="images"
                  allowedFileTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']}
                  maxSizeMB={5}
                  onUploadComplete={handleUploadComplete}
                  metadata={{ type: 'image', purpose: 'educational' }}
                />
              </TabsContent>
              
              <TabsContent value="videos">
                <WasabiFileUploader
                  category="videos"
                  allowedFileTypes={['video/mp4', 'video/webm', 'video/ogg']}
                  maxSizeMB={100}
                  onUploadComplete={handleUploadComplete}
                  metadata={{ type: 'video', purpose: 'educational' }}
                  usePresignedUrl={true}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>
              Files you've uploaded to Wasabi storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadedFiles.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No files uploaded yet
              </div>
            ) : (
              <div className="space-y-4">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="border p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{file.filename}</h3>
                        <p className="text-sm text-gray-500">
                          {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-1">
                          Key: {file.key}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGetPresignedUrl(file.key)}
                        >
                          View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteFile(file.key)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Usage Instructions</CardTitle>
            <CardDescription>
              How to use Wasabi storage in your application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Environment Variables</h3>
                <p className="text-sm">
                  Make sure to set up the following environment variables in your <code>.env.local</code> file:
                </p>
                <pre className="bg-gray-100 p-4 mt-2 rounded text-sm overflow-x-auto">
{`WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_REGION=your_region (e.g., us-east-1)
WASABI_ENDPOINT=https://s3.wasabisys.com
WASABI_BUCKET=your-bucket-name

# For client-side usage (optional)
NEXT_PUBLIC_WASABI_BUCKET=your-bucket-name
NEXT_PUBLIC_WASABI_REGION=your_region`}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Basic Usage</h3>
                <p className="text-sm">
                  Import the WasabiFileUploader component and use it in your pages:
                </p>
                <pre className="bg-gray-100 p-4 mt-2 rounded text-sm overflow-x-auto">
{`import WasabiFileUploader from '@/components/wasabi-file-uploader';

// In your component
<WasabiFileUploader
  category="documents"
  onUploadComplete={(fileData) => {
    console.log('File uploaded:', fileData);
  }}
  allowedFileTypes={['application/pdf']}
  maxSizeMB={10}
/>`}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">API Endpoints</h3>
                <p className="text-sm">
                  The following API endpoints are available for working with Wasabi storage:
                </p>
                <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                  <li><code>/api/storage/presigned-url</code> - Generate a presigned URL for direct browser uploads</li>
                  <li><code>/api/storage/upload</code> - Upload files via the server</li>
                  <li><code>/api/storage/get-url</code> - Generate a presigned URL for viewing/downloading files</li>
                  <li><code>/api/storage/delete</code> - Delete files from Wasabi</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
