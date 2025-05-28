'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useUploadStore, type UploadTask } from '@/lib/store/upload-store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Sheet, 
  SheetTrigger, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { 
  FileUp, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Pause, 
  Play,
  Trash2,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

export function UploadManager() {
  const { data: session } = useSession();
  const { uploads, removeUpload, updateUploadStatus, hasActiveUploads } = useUploadStore();
  const [isOpen, setIsOpen] = useState(false);

  // Return null if user is not a creator or admin
  if (!session?.user?.role || (session.user.role !== 'CREATOR' && session.user.role !== 'ADMIN')) {
    return null;
  }
  
  // Check if there are any active uploads
  const activeUploads = Object.values(uploads).filter(
    upload => upload.status === 'uploading' || upload.status === 'queued'
  );
  
  const completedUploads = Object.values(uploads).filter(
    upload => upload.status === 'completed'
  );
  
  const failedUploads = Object.values(uploads).filter(
    upload => upload.status === 'failed'
  );
  
  const pausedUploads = Object.values(uploads).filter(
    upload => upload.status === 'paused'
  );
  
  // Format bytes to readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Get status icon based on upload status
  const getStatusIcon = (status: UploadTask['status']) => {
    switch (status) {
      case 'uploading':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };
  
  // Render upload item
  const renderUploadItem = (upload: UploadTask) => {
    return (
      <div key={upload.id} className="mb-4 border rounded-md p-3">
        <div className="flex justify-between items-start mb-1">
          <div className="flex-1 mr-2">
            <div className="font-medium truncate">{upload.title}</div>
            <div className="text-xs text-muted-foreground flex items-center space-x-2">
              <span>Video • {upload.videoSource.toUpperCase()}</span>
              <span>•</span>
              <span>{upload.file ? formatBytes(upload.file.size) : 'Size unknown'}</span>
            </div>
          </div>
          
          <div className="flex space-x-1">
            {upload.status === 'paused' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => updateUploadStatus(upload.id, 'queued')}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            
            {upload.status === 'uploading' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => updateUploadStatus(upload.id, 'paused')}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => removeUpload(upload.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {upload.status === 'uploading' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Uploading...</span>
              <span>{upload.progress}%</span>
            </div>
            <Progress value={upload.progress} />
          </div>
        )}
        
        {upload.status !== 'uploading' && (
          <div className="flex items-center text-xs mt-1">
            {getStatusIcon(upload.status)}
            <span className="ml-1 text-muted-foreground">
              {upload.status === 'completed' && 'Completed'}
              {upload.status === 'failed' && 'Failed'}
              {upload.status === 'queued' && 'Waiting to upload...'}
              {upload.status === 'paused' && 'Paused'}
              {upload.status === 'canceled' && 'Canceled'}
            </span>
            
            <span className="ml-auto text-muted-foreground">
              {formatDistanceToNow(upload.updatedAt, { addSuffix: true })}
            </span>
          </div>
        )}
        
        {upload.status === 'failed' && upload.error && (
          <div className="mt-1 text-xs text-red-500">
            Error: {upload.error}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <>
      {/* Floating button for upload manager */}
      <Button
        variant="secondary"
        size="sm"
        className="fixed bottom-4 right-4 shadow-md flex items-center gap-2 z-50"
        onClick={() => setIsOpen(true)}
      >
        <FileUp className="h-4 w-4" />
        <span>Uploads</span>
        {hasActiveUploads() && (
          <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
            {activeUploads.length}
          </Badge>
        )}
      </Button>
      
      {/* Upload manager sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Upload Manager</SheetTitle>
            <SheetDescription>
              View and manage your active uploads. Uploads will continue in the background even if you navigate away.
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4">
            <ScrollArea className="h-[70vh]">
              {activeUploads.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Uploading ({activeUploads.length})</h3>
                  {activeUploads.map(renderUploadItem)}
                </div>
              )}
              
              {pausedUploads.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Paused ({pausedUploads.length})</h3>
                  {pausedUploads.map(renderUploadItem)}
                </div>
              )}
              
              {failedUploads.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Failed ({failedUploads.length})</h3>
                  {failedUploads.map(renderUploadItem)}
                </div>
              )}
              
              {completedUploads.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Recently Completed ({completedUploads.length})</h3>
                  {completedUploads.slice(0, 5).map(renderUploadItem)}
                </div>
              )}
              
              {activeUploads.length === 0 && 
               pausedUploads.length === 0 && 
               failedUploads.length === 0 && 
               completedUploads.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  <FileUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No uploads yet</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
