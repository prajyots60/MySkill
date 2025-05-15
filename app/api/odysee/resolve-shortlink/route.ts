import { NextRequest, NextResponse } from 'next/server';
import { setTimeout } from 'timers/promises';

/**
 * Server-side API endpoint to resolve Odysee shortlinks
 * This avoids CORS issues that happen when trying to fetch directly from client
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shortlinkUrl = searchParams.get('url');

  if (!shortlinkUrl || !shortlinkUrl.includes('ody.sh/')) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing shortlink URL' },
      { status: 400 }
    );
  }

  try {
    // We need to use GET instead of HEAD to capture proper redirects
    // with all signature query parameters for unlisted videos
    const controller = new AbortController();
    const timeoutId = setTimeout(10000).then(() => controller.abort());
    
    const response = await fetch(shortlinkUrl, {
      method: 'GET',
      redirect: 'manual', // We'll handle redirects manually to preserve all query params
      signal: controller.signal,
    }).catch(err => {
      // If the fetch was aborted or failed, we'll still check for a Location header
      return null;
    });
    
    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId as any);
    }

    // Get the Location header from the response for 301/302 redirects
    // This preserves all query parameters including signatures for unlisted videos
    const redirectUrl = response?.headers?.get('location');
    
    // Check if we got a redirect to a full Odysee URL with potential signatures
    if (redirectUrl && redirectUrl !== shortlinkUrl && redirectUrl.includes('odysee.com')) {
      return NextResponse.json({
        success: true,
        resolvedUrl: redirectUrl,
        hasSignature: redirectUrl.includes('signature=')
      });
    }

    // If we have a response URL that's different from the shortlink (browser redirect),
    // use that instead (this is a fallback)
    if (response?.url && response.url !== shortlinkUrl && response.url.includes('odysee.com')) {
      return NextResponse.json({
        success: true,
        resolvedUrl: response.url,
        hasSignature: response.url.includes('signature=')
      });
    }

    // If redirect didn't work or led to a non-Odysee URL, try to extract the ID
    const match = shortlinkUrl.match(/ody\.sh\/([a-zA-Z0-9]+)/i);
    const videoId = match ? match[1] : null;

    if (videoId) {
      // Try both possible embed URL formats
      const directEmbedUrl = `https://odysee.com/$/embed/${videoId}`;
      
      // Return the direct embed URL as fallback
      return NextResponse.json({
        success: true,
        videoId,
        directEmbedUrl,
        message: 'Using direct embed. Some restricted videos may require creator permissions.'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Could not resolve shortlink' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error resolving Odysee shortlink:', error);
    return NextResponse.json(
      { success: false, error: 'Error resolving shortlink', details: String(error) },
      { status: 500 }
    );
  }
}