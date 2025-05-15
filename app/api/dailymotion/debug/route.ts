import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Get the client ID from query params
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("client_id") || process.env.DAILYMOTION_CLIENT_ID
  
  // Various redirect URI formats to try
  const redirectUris = [
    "http://localhost:3000/api/dailymotion/callback",
    "http://localhost:3000/api/dailymotion/callback/",
    "https://localhost:3000/api/dailymotion/callback",
    "http://127.0.0.1:3000/api/dailymotion/callback"
  ]
  
  // Generate test links for each format
  const testLinks = redirectUris.map(uri => ({
    redirect_uri: uri,
    encoded: encodeURIComponent(uri),
    test_url: `https://www.dailymotion.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(uri)}&response_type=code&scope=manage_videos&state=test`
  }))
  
  // Create instructions for fixing the issue
  return NextResponse.json({ 
    message: "Dailymotion OAuth Debug Tool",
    client_id: clientId ? `${clientId.substring(0, 5)}...` : "Not configured",
    instructions: `
      1. Go to the Dailymotion Developer Portal: https://www.dailymotion.com/developer
      2. Find your app with client ID starting with: ${clientId ? clientId.substring(0, 5) : "your-client-id"}
      3. Make sure one of these EXACT redirect URIs is listed in your app settings:
    `,
    redirect_uris_to_try: redirectUris,
    test_links: testLinks,
    next_steps: `
      1. Click each test link above to see which one works
      2. When you find a working link, use that exact redirect URI in your app settings
      3. If none work, try creating a new Dailymotion app with the redirect URI pre-configured
      
      TIP: Some OAuth providers are very strict about redirect URIs and may require:
      - Exact protocol matching (http vs https)
      - Exact path matching (with or without trailing slash)
      - Exact hostname matching (localhost vs 127.0.0.1)
    `
  }, { status: 200 })
}