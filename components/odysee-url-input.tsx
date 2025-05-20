'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  parseOdyseeUrl, 
  isValidOdyseeUrl, 
  resolveOdyseeShortlink,
  extractVideoIdFromShortlink,
  getEmbedUrlFromShortlink,
  isDirectEmbedMarker,
  parseDirectEmbedMarker,
  fetchOdyseeThumbnail
} from '@/lib/odysee-helpers';
import { useToast } from '@/hooks/use-toast';
import { OdyseePlyr } from './odysee-plyr';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { OdyseeVideoMetadata } from '@/types/odysee';

interface OdyseeUrlInputProps {
  onVideoAdded: (metadata: OdyseeVideoMetadata) => void;
  initialUrl?: string;
  placeholder?: string;
  buttonText?: string;
  showPreview?: boolean;
}

export function OdyseeUrlInput({
  onVideoAdded,
  initialUrl = '',
  placeholder = 'Paste Odysee video URL here...',
  buttonText = 'Add Video',
  showPreview = true
}: OdyseeUrlInputProps) {
  const [url, setUrl] = useState(initialUrl);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [metadata, setMetadata] = useState<OdyseeVideoMetadata | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [usedDirectEmbed, setUsedDirectEmbed] = useState(false);
  const { toast } = useToast();

  // Handle URL validation and resolution of shortlinks
  useEffect(() => {
    let isMounted = true;
    setIsValidating(false);
    setUsedDirectEmbed(false);
    setShowPlayer(false); // Reset player when URL changes
    
    if (!url) {
      setIsValid(false);
      setMetadata(null);
      setResolvedUrl(null);
      return;
    }

    // Check if this is a direct embed URL with signature (unlisted video)
    // Format: https://odysee.com/%24/embed/@user/video?r=xyz&signature=abc&signature_ts=123
    if (url.includes('odysee.com') && url.includes('/embed/') && url.includes('signature=')) {
      // Extract video ID and user info from the embed URL
      const embedUrlMatch = url.match(/odysee\.com\/\$\/embed\/(@[^\/]+\/[^?&]+|[^?&]+)/);
      if (embedUrlMatch) {
        const pathPart = embedUrlMatch[1];
        let claimId, claimName;
        
        if (pathPart.startsWith('@')) {
          // Format: @username/videoid
          claimName = pathPart;
          claimId = pathPart.split('/')[1];
        } else {
          // Fallback to using the path as both claim name and ID
          claimName = pathPart;
          claimId = pathPart;
        }
        
        setIsValid(true);
        setResolvedUrl(url);
        
        // For unlisted videos, we usually can't get thumbnails, so use a default one
        setMetadata({
          url,
          claimId,
          claimName,
          embedUrl: url, // Use the full embed URL with signature
          title: 'Unlisted Odysee Video',
          thumbnailUrl: '/images/default-video-thumbnail.jpg'
        });
        
        // Auto-show preview for unlisted videos
        if (showPreview) {
          setShowPlayer(true);
        }
        return;
      }
    }
    
    // Basic validation first
    const basicValid = isValidOdyseeUrl(url);
    if (!basicValid) {
      setIsValid(false);
      setMetadata(null);
      return;
    }
    
    // If it's a standard URL, process it immediately
    if (!url.includes('ody.sh/')) {
      const parsed = parseOdyseeUrl(url);
      if (parsed) {
        setIsValid(true);
        setResolvedUrl(url);
        
        // Create initial metadata
        const initialMetadata = {
          url,
          claimId: parsed.claimId,
          claimName: parsed.claimName,
          embedUrl: parsed.embedUrl,
          title: 'Odysee Video'
        };
        
        setMetadata(initialMetadata);
        
        // Fetch thumbnail and additional metadata
        const fetchThumbnail = async () => {
          try {
            const thumbnailData = await fetchOdyseeThumbnail({
              claimId: parsed.claimId,
              url
            });
            
            if (isMounted && thumbnailData.success) {
              // Update metadata with thumbnail and additional info
              setMetadata(prevMetadata => ({
                ...prevMetadata!,
                thumbnailUrl: thumbnailData.thumbnailUrl,
                title: thumbnailData.title || prevMetadata?.title || 'Odysee Video',
                description: thumbnailData.description,
                duration: thumbnailData.duration
              }));
            }
          } catch (error) {
            console.error('Error fetching thumbnail:', error);
          }
        };
        
        fetchThumbnail();
        
        // Auto-show preview for standard URLs
        if (showPreview) {
          setShowPlayer(true);
        }
      } else {
        setIsValid(false);
        setMetadata(null);
      }
      return;
    }
    
    // For shortlinks, we need special handling
    if (url.includes('ody.sh/')) {
      setIsValidating(true);
      
      const processShortlink = async () => {
        try {
          // First try to resolve the shortlink
          const resolved = await resolveOdyseeShortlink(url);
          
          // Only update state if component is still mounted
          if (!isMounted) return;
          
          // Check if this is a direct embed marker
          if (isDirectEmbedMarker(resolved)) {
            const embedInfo = parseDirectEmbedMarker(resolved);
            if (embedInfo) {
              setUsedDirectEmbed(true);
              setIsValid(true);
              setResolvedUrl(null);
              
              // Create initial metadata
              const initialMetadata = {
                url,
                claimId: embedInfo.videoId,
                claimName: embedInfo.videoId,
                embedUrl: embedInfo.embedUrl,
                title: 'Odysee Video',
                isDirectEmbed: true
              };
              
              setMetadata(initialMetadata);
              
              // Try to fetch thumbnail for direct embed
              const fetchThumbnail = async () => {
                try {
                  const thumbnailData = await fetchOdyseeThumbnail({
                    claimId: embedInfo.videoId,
                    url: embedInfo.embedUrl
                  });
                  
                  if (isMounted && thumbnailData.success) {
                    // Update metadata with thumbnail and additional info
                    setMetadata(prevMetadata => ({
                      ...prevMetadata!,
                      thumbnailUrl: thumbnailData.thumbnailUrl,
                      title: thumbnailData.title || prevMetadata?.title || 'Odysee Video',
                      description: thumbnailData.description,
                      duration: thumbnailData.duration
                    }));
                  }
                } catch (error) {
                  console.error('Error fetching thumbnail:', error);
                }
              };
              
              fetchThumbnail();
              
              setIsValidating(false);
              
              // Auto-show preview once resolved
              if (showPreview) {
                setShowPlayer(true);
              }
              return;
            }
          }
          
          // If it's a regular resolved URL
          if (resolved !== url && resolved.includes('odysee.com')) {
            // Resolution successful
            setResolvedUrl(resolved);
            
            // Now parse the resolved URL
            const parsed = parseOdyseeUrl(resolved);
            if (parsed) {
              setIsValid(true);
              
              // Create initial metadata
              const initialMetadata = {
                url: resolved, // Use the resolved URL
                claimId: parsed.claimId,
                claimName: parsed.claimName,
                embedUrl: parsed.embedUrl,
                title: 'Odysee Video'
              };
              
              setMetadata(initialMetadata);
              
              // Fetch thumbnail for resolved URL
              const fetchThumbnail = async () => {
                try {
                  const thumbnailData = await fetchOdyseeThumbnail({
                    claimId: parsed.claimId,
                    url: resolved
                  });
                  
                  if (isMounted && thumbnailData.success) {
                    // Update metadata with thumbnail and additional info
                    setMetadata(prevMetadata => ({
                      ...prevMetadata!,
                      thumbnailUrl: thumbnailData.thumbnailUrl,
                      title: thumbnailData.title || prevMetadata?.title || 'Odysee Video',
                      description: thumbnailData.description,
                      duration: thumbnailData.duration
                    }));
                  }
                } catch (error) {
                  console.error('Error fetching thumbnail:', error);
                }
              };
              
              fetchThumbnail();
              
              // Resolution succeeded
              setIsValidating(false);
              
              // Auto-show preview once resolved
              if (showPreview) {
                setShowPlayer(true);
              }
              return;
            }
          }
          
          // If resolution failed, try direct embedding
          const videoId = extractVideoIdFromShortlink(url);
          if (videoId) {
            const embedUrl = getEmbedUrlFromShortlink(url);
            if (embedUrl) {
              setUsedDirectEmbed(true);
              setIsValid(true);
              setMetadata({
                url,
                claimId: videoId,
                claimName: videoId,
                embedUrl,
                title: 'Odysee Video',
                isDirectEmbed: true
              });
              
              // Mark as valid with direct embed
              setIsValidating(false);
              
              // Auto-show preview once resolved
              if (showPreview) {
                setShowPlayer(true);
              }
              return;
            }
          }
          
          // If we get here, both methods failed
          setIsValid(false);
          setMetadata(null);
        } catch (error) {
          console.error('Error resolving Odysee shortlink:', error);
          
          // Try direct embedding as fallback
          const videoId = extractVideoIdFromShortlink(url);
          if (videoId) {
            const embedUrl = getEmbedUrlFromShortlink(url);
            if (embedUrl) {
              setUsedDirectEmbed(true);
              setIsValid(true);
              
              // Create initial metadata
              const initialMetadata = {
                url,
                claimId: videoId,
                claimName: videoId,
                embedUrl,
                title: 'Odysee Video',
                isDirectEmbed: true
              };
              
              setMetadata(initialMetadata);
              
              // Try to fetch thumbnail for direct embed
              const fetchThumbnail = async () => {
                try {
                  const thumbnailData = await fetchOdyseeThumbnail({
                    claimId: videoId,
                    url: embedUrl
                  });
                  
                  if (isMounted && thumbnailData.success) {
                    // Update metadata with thumbnail and additional info
                    setMetadata(prevMetadata => ({
                      ...prevMetadata!,
                      thumbnailUrl: thumbnailData.thumbnailUrl,
                      title: thumbnailData.title || prevMetadata?.title || 'Odysee Video',
                      description: thumbnailData.description,
                      duration: thumbnailData.duration
                    }));
                  }
                } catch (error) {
                  console.error('Error fetching thumbnail:', error);
                }
              };
              
              fetchThumbnail();
              
              // Mark as valid with direct embed
              setIsValidating(false);
              
              // Auto-show preview once resolved
              if (showPreview) {
                setShowPlayer(true);
              }
              return;
            }
          }
          
          setIsValid(false);
          setMetadata(null);
        } finally {
          if (isMounted) {
            setIsValidating(false);
          }
        }
      };
      
      processShortlink();
    }
    
    return () => {
      isMounted = false;
    };
  }, [url, showPreview]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setShowPlayer(false);
  };

  const handleAddVideo = () => {
    if (!isValid || !metadata) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid Odysee video URL',
        variant: 'destructive',
      });
      return;
    }

    // Pass metadata to parent component
    onVideoAdded(metadata);
    
    // Show success message
    toast({
      title: 'Video Added',
      description: usedDirectEmbed 
        ? 'Odysee video has been added using direct embed' 
        : 'Odysee video has been added successfully',
    });

    // Optionally show the preview
    if (showPreview) {
      setShowPlayer(true);
    }
  };

  // Helper to display the resolved URL in a readable format
  const displayResolvedUrl = (url: string) => {
    // Show a special message for embed URLs with signatures
    if (url.includes('signature=')) {
      return 'Unlisted video with signature parameters (keep all URL parameters for access)';
    }

    // Truncate the URL if it's too long, focusing on the important parts
    if (url.length > 100) {
      // Get the beginning, with protocol and domain
      const beginning = url.substring(0, 40);
      // Get the end, which often has the important identifiers
      const end = url.substring(url.length - 60);
      return `${beginning}...${end}`;
    }
    return url;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button 
          onClick={handleAddVideo} 
          disabled={!isValid || isValidating}
          className="sm:w-auto w-full"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            buttonText
          )}
        </Button>
      </div>

      {isValidating && (
        <p className="text-sm text-blue-500">
          Processing Odysee shortlink...
        </p>
      )}

      {!isValid && !isValidating && url && (
        <p className="text-sm text-red-500">
          {url.includes('ody.sh/') 
            ? "We couldn't process this Odysee shortlink. Please try again or use the full URL."
            : url.includes('odysee.com') && url.includes('embed') 
              ? "For unlisted videos, make sure to include the full embed code with signature parameters."
              : "Please enter a valid Odysee URL (e.g., https://odysee.com/video-title:abc123 or https://ody.sh/xyz)"}
        </p>
      )}

      {usedDirectEmbed && metadata && (
        <p className="text-sm text-amber-600">
          Using direct embed method for this shortlink. Some playback features may be limited.
        </p>
      )}

      {resolvedUrl && resolvedUrl !== url && !usedDirectEmbed && (
        <p className="text-sm text-green-600 break-all">
          Shortlink resolved to: {displayResolvedUrl(resolvedUrl)}
        </p>
      )}

      {url.includes('signature=') && isValid && (
        <p className="text-sm text-green-600">
          Unlisted video detected: This video requires signature parameters to play correctly.
        </p>
      )}

      {showPreview && metadata && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">
            {metadata.title || 'Video Preview'}
            {metadata.duration && (
              <span className="ml-2 text-xs text-gray-500">
                {Math.floor(metadata.duration / 60)}:{(metadata.duration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </h3>
          
          {/* Thumbnail display before player loads */}
          {metadata.thumbnailUrl && !showPlayer && (
            <div 
              className="border border-gray-200 rounded-lg overflow-hidden relative cursor-pointer"
              onClick={() => setShowPlayer(true)}
            >
              <div 
                className="aspect-ratio-container" 
                style={{ 
                  position: 'relative', 
                  paddingBottom: '56.25%',
                  height: 0, 
                  overflow: 'hidden',
                  maxWidth: '100%' 
                }}
              >
                <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
                  <div className="absolute inset-0">
                    <img 
                      src={metadata.thumbnailUrl} 
                      alt={metadata.title || 'Video thumbnail'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="24" 
                          height="24" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="text-black"
                        >
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white">
                <p className="text-sm font-medium truncate">{metadata.title || 'Odysee Video'}</p>
              </div>
            </div>
          )}
          
          {/* Video player */}
          {showPlayer && (
            <div className="border border-gray-200 rounded-lg overflow-hidden relative">
              <div 
                className="aspect-ratio-container" 
                style={{ 
                  position: 'relative', 
                  paddingBottom: '56.25%',
                  height: 0, 
                  overflow: 'hidden',
                  maxWidth: '100%' 
                }}
              >
                <iframe
                  src={`${metadata.embedUrl}${metadata.embedUrl.includes('?') ? '&' : '?'}controls=true`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  allowFullScreen
                  title="Odysee Preview"
                />
                {/* Overlay to prevent any clicks */}
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'none' // Hide by default, set to 'block' if you want to block interaction
                  }}
                ></div>
              </div>
            </div>
          )}
          
          {metadata.description && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{metadata.description}</p>
          )}
        </div>
      )}
    </div>
  );
}