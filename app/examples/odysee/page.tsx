'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OdyseeUrlInput } from '@/components/odysee-url-input';
import { OdyseePlyr } from '@/components/odysee-plyr';
import { useToast } from '@/hooks/use-toast';

interface OdyseeVideo {
  url: string;
  claimId: string;
  claimName: string;
  embedUrl: string;
  title?: string;
}

export default function OdyseeExample() {
  const [videos, setVideos] = useState<OdyseeVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<OdyseeVideo | null>(null);
  const { toast } = useToast();

  const handleVideoAdded = async (metadata: OdyseeVideo) => {
    try {
      // In a real implementation, you would save this to your backend
      const response = await fetch('/api/videos/odysee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: metadata.url,
          title: metadata.title || `Odysee Video: ${metadata.claimName}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save video');
      }

      // Add to local state
      setVideos(prev => [metadata, ...prev]);
      setActiveVideo(metadata);
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save video',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Odysee Video Integration</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Odysee Video</CardTitle>
              <CardDescription>
                Paste an Odysee video URL to add it to your course
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OdyseeUrlInput 
                onVideoAdded={handleVideoAdded}
                placeholder="https://odysee.com/video-title:abc123"
                buttonText="Add to Course"
              />
            </CardContent>
          </Card>

          {activeVideo && (
            <Card>
              <CardHeader>
                <CardTitle>{activeVideo.title || 'Odysee Video'}</CardTitle>
                <CardDescription>
                  Claim ID: {activeVideo.claimId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OdyseePlyr
                  claimId={activeVideo.claimId}
                  claimName={activeVideo.claimName}
                  url={activeVideo.url}
                  className="h-[400px] w-full"
                  customEndScreen={true}
                  autoPlay={false}
                  title={activeVideo.title || 'Odysee Video'}
                  onError={(error) => console.error("Odysee player error:", error)}
                  onEnded={() => console.log("Video ended")}
                  onReady={() => console.log("Player ready")}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Odysee Videos</CardTitle>
              <CardDescription>
                {videos.length} video{videos.length === 1 ? '' : 's'} added
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No videos added yet. Add your first Odysee video to see it here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {videos.map((video, index) => (
                    <li key={index}>
                      <button
                        onClick={() => setActiveVideo(video)}
                        className={`text-left w-full p-3 rounded-md hover:bg-muted ${
                          activeVideo?.claimId === video.claimId
                            ? 'bg-muted'
                            : ''
                        }`}
                      >
                        <h3 className="font-medium truncate">
                          {video.title || video.claimName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {video.claimId}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div>
                <h3 className="font-medium">1. Upload to Odysee</h3>
                <p className="text-muted-foreground">
                  Upload your videos directly to Odysee.com using your creator account
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">2. Copy the URL</h3>
                <p className="text-muted-foreground">
                  Copy the URL of your uploaded Odysee video
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">3. Add to Your Course</h3>
                <p className="text-muted-foreground">
                  Paste the URL here to add the video to your course
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">Benefits</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Censorship-resistant hosting</li>
                  <li>No account strikes or takedowns</li>
                  <li>Built-in monetization options</li>
                  <li>Higher quality retention</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}