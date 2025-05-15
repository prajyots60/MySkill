import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Get the client ID and redirect URI from query params for testing
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("client_id") || process.env.DAILYMOTION_CLIENT_ID
  const redirectUri = searchParams.get("redirect_uri") || "http://localhost:3000/api/dailymotion/callback"
  
  // Display information about the configuration
  return NextResponse.json({ 
    message: "Dailymotion OAuth Configuration Checker",
    configured: {
      client_id: clientId ? clientId.substring(0, 5) + "..." : "Not configured",
      redirect_uri: redirectUri,
      encoded_redirect_uri: encodeURIComponent(redirectUri),
    },
    instructions: `
      1. Go to the Dailymotion Developer Portal
      2. Find your app with client ID ${clientId ? clientId.substring(0, 5) + "..." : "your-client-id"}
      3. In the app settings, make sure the EXACT redirect URI below is listed:
         ${redirectUri}
      4. The redirect URI is case sensitive and must match exactly (http vs https, trailing slashes, etc.)
    `,
    test_auth_url: `https://www.dailymotion.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=manage_videos&state=test`
  }, { status: 200 })
}