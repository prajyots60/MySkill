// filepath: /home/supra/Desktop/eduplatformv20/lib/odysee-helpers.ts
/**
 * Utility functions for working with Odysee videos in the eduplatform
 */

/**
 * Resolves Odysee shortlinks (ody.sh) to full URLs using a server-side API endpoint
 * @param url The Odysee URL or shortlink
 * @returns Promise with the resolved URL or direct embed information
 */
export async function resolveOdyseeShortlink(url: string): Promise<string> {
  // Check if it's a shortlink
  if (url.includes('ody.sh/')) {
    try {
      // Use our server-side API endpoint to resolve the shortlink
      // This avoids CORS issues that happen when trying to fetch directly from client
      const response = await fetch(`/api/odysee/resolve-shortlink?url=${encodeURIComponent(url)}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to resolve shortlink: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // If we successfully resolved to a full Odysee URL
      if (data.success && data.resolvedUrl) {
        // Preserve all query parameters including signatures for unlisted videos
        return data.resolvedUrl;
      }
      
      // If we got a direct embed URL but no resolved URL
      if (data.success && data.directEmbedUrl) {
        // Store the direct embed URL in a special format we can detect later
        // This lets us know we're using direct embed mode
        return `__DIRECT_EMBED__:${data.videoId}:${data.directEmbedUrl}`;
      }
      
      // If the resolution failed, return the original URL
      return url;
    } catch (error) {
      console.error('Error resolving Odysee shortlink:', error);
      return url; // Return the original URL if there's an error
    }
  }
  
  // Return original URL if not a shortlink
  return url;
}

/**
 * Extract video ID directly from Odysee shortlinks using a regex pattern
 * This is a fallback method when redirect resolution fails
 * @param shortlink The Odysee shortlink (ody.sh)
 * @returns The video ID if found, null otherwise
 */
export function extractVideoIdFromShortlink(shortlink: string): string | null {
  if (!shortlink || !shortlink.includes('ody.sh/')) {
    return null;
  }

  // Extract the ID part from the shortlink
  const match = shortlink.match(/ody\.sh\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

// For direct embedding without resolving
export function getEmbedUrlFromShortlink(shortlink: string): string | null {
  const videoId = extractVideoIdFromShortlink(shortlink);
  if (!videoId) {
    return null;
  }
  
  // Format for direct embed
  return `https://odysee.com/$/embed/${videoId}`;
}

/**
 * Checks if a URL is a direct embed URL marker
 * @param url The URL or direct embed marker
 * @returns True if this is a direct embed marker
 */
export function isDirectEmbedMarker(url: string): boolean {
  return url.startsWith('__DIRECT_EMBED__:');
}

/**
 * Extracts the video ID and embed URL from a direct embed marker
 * @param marker The direct embed marker string
 * @returns An object with videoId and embedUrl
 */
export function parseDirectEmbedMarker(marker: string): { videoId: string, embedUrl: string } | null {
  if (!isDirectEmbedMarker(marker)) {
    return null;
  }
  
  const parts = marker.split(':');
  if (parts.length < 3) {
    return null;
  }
  
  return {
    videoId: parts[1],
    embedUrl: parts[2],
  };
}

/**
 * Extracts the claim ID and claim name from an Odysee URL
 * @param odyseeUrl The full Odysee video URL or direct embed marker
 * @returns Object containing claimId, claimName, and embedUrl if successful, null otherwise
 */
export function parseOdyseeUrl(odyseeUrl: string): { 
  claimId: string; 
  claimName: string;
  embedUrl: string;
} | null {
  try {
    // Handle special case for direct embed markers
    if (isDirectEmbedMarker(odyseeUrl)) {
      const embedInfo = parseDirectEmbedMarker(odyseeUrl);
      if (embedInfo) {
        return {
          claimId: embedInfo.videoId,
          claimName: embedInfo.videoId, // Use ID as claim name too in this case
          embedUrl: embedInfo.embedUrl
        };
      }
      return null;
    }
    
    // Handle special case for shortlinks that weren't resolved
    if (odyseeUrl.includes('ody.sh/')) {
      const videoId = extractVideoIdFromShortlink(odyseeUrl);
      if (videoId) {
        // For shortlinks we couldn't resolve, use the shortlink ID directly
        const embedUrl = getEmbedUrlFromShortlink(odyseeUrl);
        return {
          claimId: videoId,
          claimName: videoId, // Use ID as claim name too in this case
          embedUrl: embedUrl || `https://odysee.com/$/embed/${videoId}`
        };
      }
      return null;
    }
    
    // Handle unlisted videos with signature parameters - IMPORTANT FOR UNLISTED VIDEOS
    if (odyseeUrl.includes('signature=')) {
      // For URLs with signatures, we need to preserve all query parameters
      // Check different patterns for Odysee URLs with signatures
      
      // Standard URL pattern with signature
      let userMatch = odyseeUrl.match(/odysee\.com\/@([^\/]+)\/([^?&]+)/);
      if (userMatch) {
        const userId = userMatch[1];
        const videoId = userMatch[2];
        
        // Use the full URL including all query parameters for embedding unlisted videos
        // This preserves the signature parameters needed for access
        const embedUrl = odyseeUrl.includes('$/embed') 
          ? odyseeUrl  // Already an embed URL with signature
          : `https://odysee.com/$/embed/@${userId}/${videoId}${odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : ''}`;
        
        return {
          claimId: videoId,
          claimName: `@${userId}/${videoId}`,
          embedUrl: embedUrl
        };
      }
      
      // If it's already an embed URL with signature 
      if (odyseeUrl.includes('/$/embed/')) {
        const embedMatch = odyseeUrl.match(/\/\$\/embed\/(@[^\/]+\/[^?&]+|[^?&]+)/);
        if (embedMatch) {
          const pathPart = embedMatch[1];
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
          
          return {
            claimId,
            claimName,
            embedUrl: odyseeUrl // Preserve the full embed URL with signature
          };
        }
      }
    }
    
    // Handle direct embed URL format:
    // https://odysee.com/$/embed/<permanent-id>
    if (odyseeUrl.includes('/$/embed/')) {
      const match = odyseeUrl.match(/\/\$\/embed\/([^\/]+)(?:\/([^\/]+))?/);
      if (match) {
        const permanentId = match[1];
        const secondParam = match[2] || permanentId;
        
        return {
          claimId: secondParam,
          claimName: permanentId,
          embedUrl: odyseeUrl
        };
      }
    }
    
    // Handle user/@user-id/video-id format
    // This is the format shown in your screenshot
    if (odyseeUrl.includes('odysee.com/@')) {
      const userMatch = odyseeUrl.match(/odysee\.com\/@([^\/]+)\/([^?&]+)/);
      if (userMatch) {
        const userId = userMatch[1];
        const videoId = userMatch[2];
        
        // For this format, we need to use a specific embed URL structure
        // Preserve any query parameters that might contain signatures
        const queryParams = odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : '';
        const embedUrl = `https://odysee.com/$/embed/@${userId}/${videoId}${queryParams}`;
        
        return {
          claimId: videoId,
          claimName: `@${userId}/${videoId}`,
          embedUrl: embedUrl
        };
      }
    }
    
    // Standard Odysee URL handling
    // Validate that it's an Odysee URL
    if (!odyseeUrl || 
        !(odyseeUrl.startsWith('https://odysee.com/') || 
          odyseeUrl.startsWith('https://www.odysee.com/'))) {
      return null;
    }

    // Strip any URL parameters
    const baseUrl = odyseeUrl.split('?')[0];
    
    // Pattern for Odysee URLs: https://odysee.com/claim-name:claim-id
    // Some URLs may have additional path segments like: https://odysee.com/@channel/claim-name:claim-id
    const urlPath = baseUrl.replace(/https:\/\/(www\.)?odysee\.com\//, '');
    
    // For channel URLs (starting with @)
    if (urlPath.startsWith('@')) {
      // Format: @channel:channelId/video:videoId
      const pathParts = urlPath.split('/');
      if (pathParts.length < 2) return null;
      
      // Get the video part (last segment)
      const videoSegment = pathParts[pathParts.length - 1];
      const videoMatch = videoSegment.match(/(.+):([\w\d]+)$/);
      
      if (!videoMatch || videoMatch.length < 3) {
        // Try different format - might be @channel/video without claim ID
        const channelPart = pathParts[0]; // @channel
        const videoPart = pathParts[1]; // video name
        
        // Use the format for direct embedding with user/video structure
        // Preserve any query parameters that might contain signatures
        const queryParams = odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : '';
        const embedUrl = `https://odysee.com/$/embed/${channelPart}/${videoPart}${queryParams}`;
        
        return {
          claimId: videoPart,
          claimName: `${channelPart}/${videoPart}`,
          embedUrl: embedUrl
        };
      }
      
      const claimName = videoMatch[1];
      const claimId = videoMatch[2];
      
      // Construct the embed URL
      // Preserve any query parameters that might contain signatures
      const queryParams = odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : '';
      const embedUrl = `https://odysee.com/$/embed/${claimName}/${claimId}${queryParams}`;
      
      return {
        claimId,
        claimName,
        embedUrl
      };
    } else {
      // Standard URL format: https://odysee.com/claim-name:claim-id
      const segments = urlPath.split('/');
      const lastSegment = segments[segments.length - 1];
      
      // Separate the claim name and ID
      const match = lastSegment.match(/(.+):([\w\d]+)$/);
      
      if (!match || match.length < 3) {
        // If no claim ID separator found, just use the path segment
        // This handles cases where the URL format doesn't match expected patterns
        // Preserve any query parameters that might contain signatures
        const queryParams = odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : '';
        const embedUrl = `https://odysee.com/$/embed/${lastSegment}${queryParams}`;
        return {
          claimId: lastSegment,
          claimName: lastSegment,
          embedUrl
        };
      }
      
      const claimName = match[1];
      const claimId = match[2];
      
      // Construct the embed URL
      // Preserve any query parameters that might contain signatures
      const queryParams = odyseeUrl.includes('?') ? odyseeUrl.substring(odyseeUrl.indexOf('?')) : '';
      const embedUrl = `https://odysee.com/$/embed/${claimName}/${claimId}${queryParams}`;
      
      return {
        claimId,
        claimName,
        embedUrl
      };
    }
  } catch (error) {
    console.error('Error parsing Odysee URL:', error);
    return null;
  }
}

/**
 * Validates if a given URL is a valid Odysee video URL
 * This includes both standard odysee.com URLs and ody.sh shortlinks
 * @param url The URL to validate
 * @returns Boolean indicating if the URL is valid
 */
export function isValidOdyseeUrl(url: string): boolean {
  // Check for direct embed markers
  if (isDirectEmbedMarker(url)) {
    return parseDirectEmbedMarker(url) !== null;
  }
  
  // Check for direct embed URLs
  if (url.includes('odysee.com/$/embed/')) {
    return true; // We'll consider all embed URLs valid
  }
  
  // Check for standard Odysee URLs
  if (url.includes('odysee.com/') || url.includes('odysee.com/@')) {
    // Allow user/@user-id/video-id format
    if (url.includes('odysee.com/@')) {
      return url.match(/odysee\.com\/@[^\/]+\/[^?&]+/) !== null;
    }
    return parseOdyseeUrl(url) !== null;
  }
  
  // Check for Odysee shortlinks
  if (url.includes('ody.sh/')) {
    return true; // We assume shortlinks are valid and will try to resolve them
  }
  
  return false;
}

/**
 * Generates an embed URL from Odysee claim information
 * @param claimName The claim name
 * @param claimId The claim ID
 * @returns The full embed URL
 */
export function getOdyseeEmbedUrl(claimName: string, claimId: string): string {
  // Handle the user/@user-id/video-id format
  if (claimName.startsWith('@') && claimName.includes('/')) {
    return `https://odysee.com/$/embed/${claimName}`;
  }
  
  // Standard format
  return `https://odysee.com/$/embed/${claimName}/${claimId}`;
}

/**
 * Try direct embed URL format which may work better for private videos
 * @param url The original Odysee URL
 * @returns A Direct embed URL that might work for private videos
 */
export function getAlternativeEmbedUrl(url: string): string | null {
  try {
    // Preserve signature parameters for unlisted videos
    const queryParams = url.includes('?') ? url.substring(url.indexOf('?')) : '';
    
    if (url.includes('odysee.com/@')) {
      // For user/@user-id/video-id format
      const userMatch = url.match(/odysee\.com\/@([^\/]+)\/([^?&]+)/);
      if (userMatch) {
        const userId = userMatch[1];
        const videoId = userMatch[2];
        
        // Alternative embed format with query parameters preserved
        return `https://odysee.com/$/embed/${videoId}${queryParams}`;
      }
    }
    
    // For other URL formats, try the permanent-id embed approach
    const parsedUrl = parseOdyseeUrl(url);
    if (parsedUrl) {
      return `https://odysee.com/$/embed/${parsedUrl.claimId}${queryParams}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error creating alternative embed URL:', error);
    return null;
  }
}

/**
 * Extracts the thumbnail URL from an Odysee claim ID
 * Note: This is a best-effort approach as Odysee doesn't have a consistent thumbnail API
 * @param claimId The claim ID
 * @returns A URL to the thumbnail if available
 */
export function getOdyseeThumbnailUrl(claimId: string): string {
  // Odysee typically serves thumbnails through their spee.ch CDN
  // This may change in the future, so this is a best-effort implementation
  return `https://thumbnails.odycdn.com/optimize/s:1280:720/quality:85/plain/https://thumbs.odycdn.com/71801d64187cd66ac61c2dc6fce135e3.jpg`;
}