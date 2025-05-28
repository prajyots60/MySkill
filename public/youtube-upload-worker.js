// YouTube Upload Service Worker - Bypasses CORS restrictions

// Listen for fetch events
self.addEventListener('fetch', event => {
  // Only intercept YouTube upload API requests
  if (event.request.url.includes('googleapis.com/upload/youtube')) {
    event.respondWith(handleYouTubeUpload(event.request));
  }
});

// Handle YouTube upload requests
async function handleYouTubeUpload(request) {
  // Clone the original request to modify it
  const originalUrl = request.url;
  const originalMethod = request.method;
  
  // Extract headers from the original request
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  
  // Create a new request with the same parameters but without CORS restrictions
  const modifiedRequest = new Request(originalUrl, {
    method: originalMethod,
    headers: headers,
    body: originalMethod !== 'GET' && originalMethod !== 'HEAD' ? await request.blob() : null,
    mode: 'cors',
    credentials: 'omit'
  });
  
  // Perform the fetch
  try {
    const response = await fetch(modifiedRequest);
    // Create a new response with CORS headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Range, X-Upload-Content-Type, X-Upload-Content-Length'
      }
    });
  } catch (error) {
    console.error('Service worker error handling YouTube upload:', error);
    return new Response(JSON.stringify({ error: 'Failed to proxy request to YouTube' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Log when the service worker is installed
self.addEventListener('install', event => {
  self.skipWaiting();
  console.log('YouTube Upload Service Worker installed');
});

// Log when the service worker is activated
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  console.log('YouTube Upload Service Worker activated');
});
