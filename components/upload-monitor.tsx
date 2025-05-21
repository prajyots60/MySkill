'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, PlayCircle, Trash2, PauseCircle } from 'lucide-react';
import { useResumableUpload } from '@/hooks/use-resumable-upload';

interface UploadMonitorProps {
  className?: string;
}

export function UploadMonitor({ className }: UploadMonitorProps) {
  // Use the resumable upload hook
  const {
    getActiveUploads,
    loadStoredUploads
  } = useResumableUpload();
  
  // Store active uploads in state
  const [activeUploads, setActiveUploads] = useState<Array<any>>([]);
  
  // Define update function with useCallback to maintain reference stability
  const updateActiveUploads = useCallback(() => {
    const uploads = getActiveUploads();
    setActiveUploads(uploads);
  }, [getActiveUploads]);
  
  // Effect for initial load and setting up polling
  useEffect(() => {
    // Load all stored uploads on mount
    loadStoredUploads();
    
    // Initial load
    updateActiveUploads();
    
    // Set up polling to check for active uploads
    const intervalId = setInterval(updateActiveUploads, 2000);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [loadStoredUploads, updateActiveUploads]);
  
  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Calculate time elapsed since last update
  const timeElapsed = (timestamp: number): string => {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    
    if (secondsAgo < 60) {
      return `${secondsAgo}s ago`;
    } else if (secondsAgo < 3600) {
      return `${Math.floor(secondsAgo / 60)}m ago`;
    } else if (secondsAgo < 86400) {
      return `${Math.floor(secondsAgo / 3600)}h ago`;
    } else {
      return `${Math.floor(secondsAgo / 86400)}d ago`;
    }
  };
  
  if (activeUploads.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      <h2 className="text-xl font-semibold">Active Uploads</h2>
      
      {activeUploads.map((upload) => {
        const completedPercentage = Math.round((upload.completedChunks / upload.totalChunks) * 100);
        const pausedChunks = upload.chunks.filter(c => c.status === 'pending').length;
        const failedChunks = upload.chunks.filter(c => c.status === 'failed').length;
        const isStalled = Date.now() - upload.lastUpdated > 5 * 60 * 1000; // 5 minutes without updates
        
        return (
          <Card key={upload.fileId} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">{upload.fileName}</CardTitle>
                <div className="flex items-center gap-2">
                  {failedChunks > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" /> {failedChunks} Failed Chunks
                    </Badge>
                  )}
                  {isStalled && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-600/20">
                      Stalled
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <div>Size: {formatFileSize(upload.fileSize)}</div>
                <div>{upload.completedChunks} of {upload.totalChunks} chunks</div>
              </div>
              
              <Progress value={completedPercentage} className="h-2" />
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Last activity: {timeElapsed(upload.lastUpdated)}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 px-2 text-xs">
                    <PauseCircle className="h-3 w-3 mr-1" />
                    Pause
                  </Button>
                  
                  <Button size="sm" variant="outline" className="h-8 px-2 text-xs">
                    <PlayCircle className="h-3 w-3 mr-1" />
                    Resume
                  </Button>
                  
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-red-500 hover:text-red-600">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      <div className="text-center text-xs text-muted-foreground pt-2">
        <p>Uploads will remain resumable for up to 7 days</p>
      </div>
    </div>
  );
}
