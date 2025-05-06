"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, Youtube, Database, HardDrive } from "lucide-react"
import { useYouTubeStore } from "@/lib/store/youtube-store"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import { useGFormsStore } from "@/lib/store/gforms-store"
import { formatDate, formatBytes } from "@/lib/utils/format"

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

  // Add Google Forms state hooks
  const { 
    connected: gformsConnected, 
    details: gformsDetails, 
    loading: gformsLoading, 
    error: gformsError, 
    checkConnectionStatus: checkGFormsStatus 
  } = useGFormsStore()

  // Check connection status on page load
  useEffect(() => {
    if (status === "authenticated") {
      checkYouTubeStatus()
      checkGDriveStatus()
      checkGFormsStatus()
    }
  }, [status, checkYouTubeStatus, checkGDriveStatus, checkGFormsStatus])

  // Handle connect to YouTube
  const handleYouTubeConnect = () => {
    window.location.href = "/api/youtube/connect"
  }

  // Handle connect to Google Drive
  const handleGDriveConnect = () => {
    window.location.href = "/api/gdrive/connect"
  }

  // Handle connect to Google Forms
  const handleGFormsConnect = () => {
    window.location.href = "/api/googleforms/connect"
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

  // Handle refresh Google Forms connection status
  const handleGFormsRefresh = async () => {
    await checkGFormsStatus()
    toast({
      title: "Success",
      description: "Google Forms connection status refreshed",
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

        {/* Google Forms Connection Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg 
                className="h-5 w-5 text-green-600" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 10V14H10V21H14V14H17L18 10H14V8C14 7.73478 14.1054 7.48043 14.2929 7.29289C14.4804 7.10536 14.7348 7 15 7H18V3H15C13.6739 3 12.4021 3.52678 11.4645 4.46447C10.5268 5.40215 10 6.67392 10 8V10H7Z" 
                      fill="currentColor"/>
              </svg>
              Google Forms Connection
            </CardTitle>
            <CardDescription>Connect your Google account to create and manage exams through Google Forms</CardDescription>
          </CardHeader>
          <CardContent>
            {gformsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : gformsError ? (
              <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive">Error checking connection status</h3>
                  <p className="text-sm text-muted-foreground">{gformsError}</p>
                </div>
              </div>
            ) : gformsConnected ? (
              <div className="space-y-6">
                <div className="bg-success/10 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <h3 className="font-medium text-success">Connected to Google Forms</h3>
                    <p className="text-sm text-muted-foreground">Your account is successfully connected to Google Forms</p>
                  </div>
                </div>

                {/* Google Forms Connection Details */}
                {gformsDetails && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      {gformsDetails.profileImage && (
                        <img
                          src={gformsDetails.profileImage || "/placeholder.svg"}
                          alt="Profile"
                          className="w-16 h-16 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{gformsDetails.name}</h3>
                        <p className="text-sm text-muted-foreground">{gformsDetails.email}</p>
                        {gformsDetails.connectedAt && (
                          <p className="text-sm text-muted-foreground">
                            Connected since: {formatDate(new Date(gformsDetails.connectedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-medium">What you can do:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Create quizzes and exams using Google Forms</li>
                    <li>Set custom scoring rules with negative marking</li>
                    <li>Collect and evaluate student responses automatically</li>
                    <li>Use your own branded UI while leveraging Google Forms in the backend</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Not connected to Google Forms</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Google account to create and manage exams through Google Forms.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Benefits of connecting:</h3>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Create quizzes and assessments with multiple question types</li>
                    <li>Automatically grade multiple-choice questions</li>
                    <li>Track student performance with detailed analytics</li>
                    <li>Leverage Google Forms reliability while using your platform's UI</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Important
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You will need a Google account with access to Google Forms and Google Sheets. This integration lets you create and manage exams using Google's reliable infrastructure.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {gformsConnected ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGFormsRefresh} disabled={gformsLoading}>
                    {gformsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh Status
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => window.location.href = "/api/googleforms/reconnect"}
                  >
                    Reconnect Google Forms
                  </Button>
                </div>
                <Button asChild>
                  <a href="https://docs.google.com/forms" target="_blank" rel="noopener noreferrer">
                    Open Google Forms <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleGFormsRefresh} disabled={gformsLoading}>
                  {gformsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Status
                </Button>
                <Button onClick={handleGFormsConnect} disabled={gformsLoading}>
                  {gformsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                    <svg 
                      className="h-4 w-4 mr-2 text-green-600" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M7 10V14H10V21H14V14H17L18 10H14V8C14 7.73478 14.1054 7.48043 14.2929 7.29289C14.4804 7.10536 14.7348 7 15 7H18V3H15C13.6739 3 12.4021 3.52678 11.4645 4.46447C10.5268 5.40215 10 6.67392 10 8V10H7Z" 
                          fill="currentColor"/>
                    </svg>
                  )}
                  Connect to Google Forms
                </Button>
              </>
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