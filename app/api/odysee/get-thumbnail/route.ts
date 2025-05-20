import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side API endpoint to get thumbnail for an Odysee video
 * This avoids CORS issues that happen when trying to fetch directly from client
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const claimId = searchParams.get('claimId');
  const claimName = searchParams.get('claimName');
  const url = searchParams.get('url');

  if (!claimId && !url) {
    return NextResponse.json(
      { success: false, error: 'Missing claimId or url parameter' },
      { status: 400 }
    );
  }

  try {
    let apiUrl: string;
    
    // If we have a claim ID, we can use it directly with the Odysee API
    if (claimId) {
      apiUrl = `https://api.odysee.com/file/get?claim_id=${claimId}`;
    } 
    // If we have a claim name (channel/video format), we can use that
    else if (claimName && claimName.includes('/')) {
      const [channel, videoName] = claimName.split('/');
      apiUrl = `https://api.odysee.com/file/get?name=${videoName}&channel_name=${channel.replace('@', '')}`;
    }
    // Otherwise, we'll need to extract info from the URL
    else if (url) {
      // For URLs with signatures (unlisted videos), we can't easily get thumbnails
      if (url.includes('signature=')) {
        return NextResponse.json({
          success: false,
          error: 'Cannot get thumbnail for unlisted videos with signatures',
          thumbnailUrl: '/images/default-video-thumbnail.jpg' // Return default thumbnail
        });
      }

      // Extract potential claim ID from URL
      const urlClaimIdMatch = url.match(/\/([a-zA-Z0-9]+)(?:[?#]|$)/);
      const urlClaimId = urlClaimIdMatch ? urlClaimIdMatch[1] : null;
      
      if (!urlClaimId) {
        return NextResponse.json({
          success: false,
          error: 'Could not extract claim ID from URL',
          thumbnailUrl: '/images/default-video-thumbnail.jpg' // Return default thumbnail
        });
      }
      
      apiUrl = `https://api.odysee.com/file/get?claim_id=${urlClaimId}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Insufficient parameters to get thumbnail' },
        { status: 400 }
      );
    }

    // Make request to Odysee API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Odysee API: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if we got a successful response with a thumbnail
    if (data.success && data.data && data.data.value && data.data.value.thumbnail) {
      const thumbnailUrl = data.data.value.thumbnail.url;
      
      // For thumbnails hosted on Odysee/LBRY servers
      if (thumbnailUrl && (thumbnailUrl.includes('https://spee.ch/') || thumbnailUrl.includes('https://thumbnails.odycdn.com/'))) {
        return NextResponse.json({
          success: true,
          thumbnailUrl,
          title: data.data.value.title || null,
          description: data.data.value.description || null,
          duration: data.data.value.video?.duration || null
        });
      }
      
      // For thumbnails hosted elsewhere or invalid URLs
      if (thumbnailUrl) {
        return NextResponse.json({
          success: true,
          thumbnailUrl,
          title: data.data.value.title || null,
          description: data.data.value.description || null,
          duration: data.data.value.video?.duration || null
        });
      }
    }
    
    // Default response if no thumbnail found
    return NextResponse.json({
      success: false,
      error: 'No thumbnail found for this video',
      thumbnailUrl: '/images/default-video-thumbnail.jpg' // Return default thumbnail
    });
  } catch (error) {
    console.error('Error fetching Odysee thumbnail:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error fetching thumbnail', 
        details: String(error),
        thumbnailUrl: '/images/default-video-thumbnail.jpg' // Return default thumbnail
      },
      { status: 500 }
    );
  }
}
