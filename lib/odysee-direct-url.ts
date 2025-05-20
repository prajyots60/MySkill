/**
 * Get the direct URL for an Odysee video, including handling for unlisted videos
 * @param url The original Odysee URL
 * @param resolvedUrl The resolved URL (if available)
 * @param directUrl Explicitly provided direct URL (from API or component)
 * @returns The best URL to use for playback
 */
export function getOdyseeDirectUrl(
  url: string, 
  resolvedUrl?: string | null, 
  directUrl?: string | null
): string {
  // First priority: explicitly provided direct URL
  if (directUrl) {
    return directUrl;
  }
  
  // Second priority: URLs with signatures (unlisted videos)
  if (url.includes('signature=')) {
    return url;
  }
  
  // Third priority: resolved URL (from shortlinks)
  if (resolvedUrl) {
    return resolvedUrl;
  }
  
  // Fall back to the original URL
  return url;
}
