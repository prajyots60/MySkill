"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ReloadIcon, CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons"

// Type definitions
interface ErrorStats {
  [key: string]: number
}

interface DatabaseHealth {
  isConnected: boolean
  errorStats: ErrorStats
  connectionTime: number
  dbMetrics?: {
    migration_count: number
    max_connections: string
    active_connections: number
  }
}

interface ApiResponse {
  status: string
  data: DatabaseHealth
  timestamp: string
}

export default function DbMonitoringPage() {
  const [healthData, setHealthData] = useState<DatabaseHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<number>(30) // seconds
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealthData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/health/database")
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
      
      const data: ApiResponse = await response.json()
      setHealthData(data.data)
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
      console.error("Error fetching health data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
    
    // Set up auto-refresh
    let intervalId: NodeJS.Timeout | null = null
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchHealthData()
      }, refreshInterval * 1000)
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [refreshInterval, autoRefresh])

  // Render error stats as a formatted list
  const renderErrorStats = (stats: ErrorStats) => {
    const entries = Object.entries(stats)
    
    if (entries.length === 0) {
      return <p className="text-sm text-green-600">No errors recorded in the monitoring period</p>
    }
    
    return (
      <div className="space-y-2">
        {entries.map(([errorType, count]) => (
          <div key={errorType} className="flex justify-between items-center">
            <div className="flex-1">
              <span className="text-sm font-medium">{errorType.replace(/_/g, ' ')}</span>
              <Progress value={Math.min((count / 10) * 100, 100)} className="h-2 mt-1" />
            </div>
            <span className="text-sm font-bold ml-2">{count}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Database Monitoring Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHealthData}
            disabled={loading}
          >
            {loading ? <ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> : <ReloadIcon className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <CrossCircledIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>Current database connection health</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <ReloadIcon className="h-8 w-8 animate-spin" />
              </div>
            ) : healthData ? (
              <div className="flex flex-col items-center">
                {healthData.isConnected ? (
                  <CheckCircledIcon className="h-12 w-12 text-green-500 mb-2" />
                ) : (
                  <CrossCircledIcon className="h-12 w-12 text-red-500 mb-2" />
                )}
                <p className="text-xl font-bold">
                  {healthData.isConnected ? "Connected" : "Disconnected"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Response time: {healthData.connectionTime}ms
                </p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Active Connections</CardTitle>
            <CardDescription>Current database connection pool</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <ReloadIcon className="h-8 w-8 animate-spin" />
              </div>
            ) : healthData?.dbMetrics ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Active Connections</span>
                    <span className="text-sm font-medium">
                      {healthData.dbMetrics.active_connections} / {healthData.dbMetrics.max_connections}
                    </span>
                  </div>
                  <Progress 
                    value={(healthData.dbMetrics.active_connections / parseInt(healthData.dbMetrics.max_connections)) * 100} 
                    className="h-2" 
                  />
                </div>
                <div className="pt-2 text-sm text-muted-foreground">
                  <p>Database migrations: {healthData.dbMetrics.migration_count}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No connection data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Auto-Refresh Settings</CardTitle>
            <CardDescription>Configure monitoring refresh rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-refresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="auto-refresh" className="text-sm font-medium">
                  Enable auto-refresh
                </label>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="refresh-interval" className="text-sm font-medium">
                  Refresh interval: {refreshInterval} seconds
                </label>
                <input
                  type="range"
                  id="refresh-interval"
                  min="5"
                  max="60"
                  step="5"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  disabled={!autoRefresh}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5s</span>
                  <span>30s</span>
                  <span>60s</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="errors" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="errors">Error Statistics</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Database Error Statistics</CardTitle>
              <CardDescription>
                Recent database connection errors tracked by the monitoring system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <ReloadIcon className="h-8 w-8 animate-spin" />
                </div>
              ) : healthData ? (
                renderErrorStats(healthData.errorStats)
              ) : (
                <p className="text-center text-muted-foreground py-4">No error data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Connection Performance</CardTitle>
              <CardDescription>
                Database connection time and response metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-4">Performance history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}