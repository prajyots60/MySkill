"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import GoogleDriveFileBrowser from "@/components/google-drive-file-browser"
import { HardDrive, Database, AlertCircle } from "lucide-react"
import { useGDriveStore } from "@/lib/store/gdrive-store"
import { Card, CardContent } from "@/components/ui/card"
import { formatBytes } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"

export default function GoogleDrivePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { connected, details, loading, checkConnectionStatus } = useGDriveStore()
  const [storageInfo, setStorageInfo] = useState<{
    usage: string;
    limit: string;
  } | null>(null)
  
  // Check connection status on page load
  useEffect(() => {
    if (status === "authenticated") {
      checkConnectionStatus()
      // Also fetch storage info directly
      fetchStorageInfo()
    }
  }, [status, checkConnectionStatus])
  
  // Fetch storage info directly
  const fetchStorageInfo = async () => {
    try {
      const response = await fetch("/api/gdrive/storage")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.storageQuota) {
          setStorageInfo(data.storageQuota)
        }
      }
    } catch (error) {
      console.error("Error fetching storage info:", error)
    }
  }

  // Use either the store details or directly fetched storage info
  const storageQuota = details?.storageQuota || storageInfo
  
  // Function to render storage bar
  const renderStorageBar = () => {
    if (!storageQuota || !storageQuota.usage || !storageQuota.limit) {
      return (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database className="h-5 w-5 text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">Storage Usage</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchStorageInfo} 
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Loading storage information...</p>
          </CardContent>
        </Card>
      )
    }
    
    const usageBytes = parseInt(storageQuota.usage);
    const limitBytes = parseInt(storageQuota.limit);
    const percentUsed = Math.min(100, (usageBytes / limitBytes) * 100);
    
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-medium">Storage Usage</h2>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStorageInfo} 
              className="text-xs"
            >
              Refresh
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{formatBytes(usageBytes)} used</span>
              <span className="text-muted-foreground">of {formatBytes(limitBytes)} total</span>
            </div>
            
            {/* Simple CSS progress bar */}
            <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full"
                style={{ width: `${percentUsed}%` }}
              ></div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {percentUsed.toFixed(1)}% of storage used
            </p>
            
            {percentUsed > 90 && (
              <p className="text-sm text-red-500 font-medium flex items-center">
                <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                Your storage is almost full. Consider freeing up some space.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-[100px] w-full rounded-lg mb-6" />
          <Skeleton className="h-[500px] w-full rounded-lg" />
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center">
          <HardDrive className="h-6 w-6 text-blue-500 mr-2" />
          <h1 className="text-3xl font-bold">Google Drive Files</h1>
        </div>
        
        {renderStorageBar()}
        
        <GoogleDriveFileBrowser />
      </div>
    </div>
  )
}