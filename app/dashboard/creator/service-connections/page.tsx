"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, Youtube, Database, HardDrive, Film } from "lucide-react"
import { useYouTubeStore } from "@/lib/store/youtube-store"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import { useDailymotionStore } from "@/lib/store/dailymotion-store"
import { formatDate, formatBytes } from "@/lib/utils/format"
import { DailymotionConnectForm } from "./dailymotion-connect-form"

export default function ServiceConnectionsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  
  // YouTube connection state
  const { 
    connected: youtubeConnected, 
    details: youtubeDetails, 
    loading: youtubeLoading, 
    error: youtubeError, 
    checkConnectionStatus: checkYouTubeStatus 
  } = useYouTubeStore()
  
  // Google Drive connection state
  const { 
    connected: gdriveConnected, 
    details: gdriveDetails, 
    loading: gdriveLoading, 
    error: gdriveError, 
    checkConnectionStatus: checkGDriveStatus 
  } = useGDriveStore()
  
  // Dailymotion connection state
  const {
    connected: dailymotionConnected,
    details: dailymotionDetails,
    loading: dailymotionLoading,
    error: dailymotionError,
    checkConnectionStatus: checkDailymotionStatus
  } = useDailymotionStore()

  // Check connection status on page load
  useEffect(() => {
    if (status === "authenticated") {
      checkYouTubeStatus()
      checkGDriveStatus()
      checkDailymotionStatus()
    }
  }, [status, checkYouTubeStatus, checkGDriveStatus, checkDailymotionStatus])

  // Handle connect to YouTube
  const handleYouTubeConnect = () => {
    window.location.href = "/api/youtube/connect"
  }

  // Handle connect to Google Drive
  const handleGDriveConnect = () => {
    window.location.href = "/api/gdrive/connect"
  }
  
  // Handle connect to Dailymotion
  const handleDailymotionConnect = () => {
    window.location.href = "/api/dailymotion/connect"
  }

  // Handle refresh YouTube connection status
  const handleYouTubeRefresh = async () => {
    await checkYouTubeStatus()
    toast({
      title: "Success",
      description: "YouTube connection status refreshed",
    })
  }

  // Handle refresh Google Drive connection status
  const handleGDriveRefresh = async () => {
    await checkGDriveStatus()
    toast({
      title: "Success",
      description: "Google Drive connection status refreshed",
    })
  }
  
  // Handle refresh Dailymotion connection status
  const handleDailymotionRefresh = async () => {
    await checkDailymotionStatus()
    toast({
      title: "Success",
      description: "Dailymotion connection status refreshed",
    })
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || (session?.user?.role !== "CREATOR" && session?.user?.role !== "ADMIN")) {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Service Connections</h1>
        
        {/* YouTube Connection Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              YouTube Connection
            </CardTitle>
            <CardDescription>Connect your YouTube account to upload videos directly from the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {youtubeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : youtubeError ? (
              <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">Error checking connection status</h3>
                  <p className="text-sm text-muted-foreground">{youtubeError}</p>
                </div>
              </div>
            ) : youtubeConnected ? (
              <div className="space-y-6">
                <div className="bg-success/10 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <h3 className="font-medium text-success">Connected to YouTube</h3>
                    <p className="text-sm text-muted-foreground">Your account is successfully connected to YouTube</p>
                  </div>
                </div>

                {youtubeDetails && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      {youtubeDetails.thumbnailUrl && (
                        <img
                          src={youtubeDetails.thumbnailUrl || "/placeholder.svg"}
                          alt="Channel thumbnail"
                          className="w-16 h-16 rounded-full"
                        />
                      )}
                      <div>
                        <h3 className="font-medium text-lg">{youtubeDetails.channelName}</h3>
                        <p className="text-sm text-muted-foreground">Channel ID: {youtubeDetails.channelId}</p>
                        {youtubeDetails.connectedAt && (
                          <p className="text-sm text-muted-foreground">
                            Connected since: {formatDate(new Date(youtubeDetails.connectedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-medium">What you can do:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload videos directly to your YouTube channel</li>
                    <li>Create and schedule live streams</li>
                    <li>Manage your YouTube content from this platform</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Not connected to YouTube</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your YouTube account to upload videos directly from this platform.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Benefits of connecting:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload videos directly to your YouTube channel</li>
                    <li>Create and schedule live streams</li>
                    <li>Manage your YouTube content from this platform</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Important
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You will need a YouTube account with permissions to upload videos. Make sure your account is in good
                    standing and has no strikes or restrictions.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {youtubeConnected ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleYouTubeRefresh} disabled={youtubeLoading}>
                    {youtubeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh Status
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => window.location.href = "/api/youtube/reconnect"}
                  >
                    Reconnect YouTube
                  </Button>
                </div>
                <Button asChild>
                  <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">
                    Open YouTube Studio <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleYouTubeRefresh} disabled={youtubeLoading}>
                  {youtubeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Status
                </Button>
                <Button onClick={handleYouTubeConnect} disabled={youtubeLoading}>
                  {youtubeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Youtube className="mr-2 h-4 w-4" />}
                  Connect to YouTube
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Google Drive Connection Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-blue-500" />
              Google Drive Connection
            </CardTitle>
            <CardDescription>Connect your Google Drive account to manage documents and files</CardDescription>
          </CardHeader>
          <CardContent>
            {gdriveLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : gdriveError ? (
              <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">Error checking connection status</h3>
                  <p className="text-sm text-muted-foreground">{gdriveError}</p>
                </div>
              </div>
            ) : gdriveConnected ? (
              <div className="space-y-6">
                <div className="bg-success/10 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <h3 className="font-medium text-success">Connected to Google Drive</h3>
                    <p className="text-sm text-muted-foreground">Your account is successfully connected to Google Drive</p>
                  </div>
                </div>

                {/* Google Drive Connection Details */}
                {gdriveDetails && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      {gdriveDetails.profileImage && (
                        <img
                          src={gdriveDetails.profileImage || "/placeholder.svg"}
                          alt="Profile"
                          className="w-16 h-16 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{gdriveDetails.name}</h3>
                        <p className="text-sm text-muted-foreground">{gdriveDetails.email}</p>
                        {gdriveDetails.connectedAt && (
                          <p className="text-sm text-muted-foreground">
                            Connected since: {formatDate(new Date(gdriveDetails.connectedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Google Drive Storage Usage - Simple CSS Implementation */}
                {gdriveDetails && gdriveDetails.storageQuota && gdriveDetails.storageQuota.usage && (
                  <div className="border rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <Database className="h-4 w-4 text-blue-500 mr-2" />
                        <h3 className="font-medium">Storage Usage</h3>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {formatBytes(parseInt(gdriveDetails.storageQuota.usage || "0"))}
                        </span>
                        {gdriveDetails.storageQuota.limit && (
                          <span className="text-muted-foreground">
                            of {formatBytes(parseInt(gdriveDetails.storageQuota.limit))}
                          </span>
                        )}
                      </div>
                      
                      {gdriveDetails.storageQuota.usage && gdriveDetails.storageQuota.limit && (
                        <>
                          {/* Simple CSS progress bar */}
                          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full"
                              style={{ 
                                width: `${Math.min(100, (parseInt(gdriveDetails.storageQuota.usage) / parseInt(gdriveDetails.storageQuota.limit)) * 100)}%` 
                              }}
                            ></div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            {Math.min(100, (parseInt(gdriveDetails.storageQuota.usage) / parseInt(gdriveDetails.storageQuota.limit)) * 100).toFixed(1)}% used
                          </p>
                          
                          {(parseInt(gdriveDetails.storageQuota.usage) / parseInt(gdriveDetails.storageQuota.limit)) > 0.9 && (
                            <p className="text-xs text-red-500 font-medium flex items-center">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Your storage is almost full. Consider freeing up some space.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-medium">What you can do:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload documents and files directly to your Google Drive</li>
                    <li>Store and manage course materials securely</li>
                    <li>Organize content using folders and share with your students</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Not connected to Google Drive</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Google Drive account to manage files directly from this platform.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Benefits of connecting:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload files directly to your Google Drive</li>
                    <li>Create and organize course materials in folders</li>
                    <li>Manage documents from a single interface</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Important
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You will need a Google account with Google Drive enabled. The platform will only access the files and folders you create through it.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {gdriveConnected ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGDriveRefresh} disabled={gdriveLoading}>
                    {gdriveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh Status
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => window.location.href = "/api/gdrive/reconnect"}
                  >
                    Reconnect Google Drive
                  </Button>
                </div>
                <Button asChild>
                  <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer">
                    Open Google Drive <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleGDriveRefresh} disabled={gdriveLoading}>
                  {gdriveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Status
                </Button>
                <Button onClick={handleGDriveConnect} disabled={gdriveLoading}>
                  {gdriveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
                  Connect to Google Drive
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
        
        {/* Dailymotion Connection Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-blue-400" />
              Dailymotion Connection
            </CardTitle>
            <CardDescription>Connect your Dailymotion account to upload videos directly from the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {dailymotionLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : dailymotionError ? (
              <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">Error checking connection status</h3>
                  <p className="text-sm text-muted-foreground">{dailymotionError}</p>
                </div>
              </div>
            ) : dailymotionConnected ? (
              <div className="space-y-6">
                <div className="bg-success/10 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <h3 className="font-medium text-success">Connected to Dailymotion</h3>
                    <p className="text-sm text-muted-foreground">Your account is successfully connected to Dailymotion</p>
                  </div>
                </div>

                {dailymotionDetails && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      {dailymotionDetails.profilePictureUrl && (
                        <img
                          src={dailymotionDetails.profilePictureUrl || "/placeholder.svg"}
                          alt="Profile"
                          className="w-16 h-16 rounded-full"
                        />
                      )}
                      <div>
                        <h3 className="font-medium text-lg">{dailymotionDetails.username}</h3>
                        <p className="text-sm text-muted-foreground">User ID: {dailymotionDetails.userId}</p>
                        {dailymotionDetails.connectedAt && (
                          <p className="text-sm text-muted-foreground">
                            Connected since: {formatDate(new Date(dailymotionDetails.connectedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-medium">What you can do:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload videos directly to your Dailymotion account</li>
                    <li>Create and manage playlists</li>
                    <li>Access video analytics and publishing tools</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Not connected to Dailymotion</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Dailymotion account to upload videos directly from this platform.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Benefits of connecting:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Upload videos directly to your Dailymotion account</li>
                    <li>Create and manage playlists</li>
                    <li>Access video analytics and publishing tools</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Important
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You will need a Dailymotion account with permissions to upload videos. The platform will only access the videos you upload through it.
                  </p>
                </div>

                <DailymotionConnectForm />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {dailymotionConnected ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDailymotionRefresh} disabled={dailymotionLoading}>
                    {dailymotionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh Status
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => window.location.href = "/api/dailymotion/reconnect"}
                  >
                    Reconnect Dailymotion
                  </Button>
                </div>
                <Button asChild>
                  <a href="https://www.dailymotion.com/myvideos" target="_blank" rel="noopener noreferrer">
                    Open Dailymotion <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleDailymotionRefresh} disabled={dailymotionLoading}>
                {dailymotionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh Status
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Need help?</h3>
          <p className="text-sm text-muted-foreground">
            If you're having trouble connecting your accounts, please check our{" "}
            <a href="#" className="text-primary hover:underline">
              documentation
            </a>{" "}
            or{" "}
            <a href="#" className="text-primary hover:underline">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}