"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const SkeletonCard = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      <div className="h-full bg-muted/30 shimmer"></div>
    </div>
  )
}

export const SkeletonText = ({ width = "w-full", height = "h-4", className = "" }: { width?: string, height?: string, className?: string }) => {
  return <div className={`${width} ${height} rounded bg-muted/30 shimmer ${className}`}></div>
}

export const SkeletonMetricCard = () => {
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <SkeletonText width="w-1/3" />
          <div className="w-6 h-6 rounded-full bg-muted/30 shimmer"></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonText width="w-20" height="h-7" />
            <SkeletonText width="w-24" height="h-3" />
          </div>
          <div className="w-10 h-10 rounded-full bg-muted/30 shimmer"></div>
        </div>
      </CardContent>
    </Card>
  )
}

export const SkeletonChartCard = ({ height = "h-[300px]" }: { height?: string }) => {
  return (
    <Card>
      <CardHeader>
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-1/2" height="h-3" />
      </CardHeader>
      <CardContent className={height}>
        <div className="h-full bg-muted/30 shimmer rounded"></div>
      </CardContent>
    </Card>
  )
}

export const SkeletonBreakdownCard = () => {
  return (
    <Card>
      <CardHeader>
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-1/2" height="h-3" />
      </CardHeader>
      <CardContent className="h-[400px]">
        <div className="h-full bg-muted/30 shimmer rounded"></div>
      </CardContent>
      <CardFooter className="pt-3 pb-4">
        <div className="w-full flex flex-col space-y-3">
          <div className="text-center space-y-3">
            <SkeletonText width="w-1/3 mx-auto" height="h-5" />
            <SkeletonText width="w-1/4 mx-auto" height="h-7" />
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonText width="w-2/3" height="h-3" />
                <SkeletonText width="w-1/3" height="h-4" />
              </div>
            ))}
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

export const AnalyticsSkeletonDashboard = () => {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <SkeletonText width="w-48" height="h-8" />
          <SkeletonText width="w-64" height="h-4" className="mt-1" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <SkeletonCard className="w-[180px] h-10" />
          <SkeletonCard className="w-[180px] h-10" />
          <SkeletonCard className="w-10 h-10" />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>

      <div className="mb-8">
        <SkeletonCard className="h-12 w-full sm:w-auto" />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChartCard />
          <SkeletonChartCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChartCard />
          <SkeletonChartCard />
          <SkeletonChartCard />
        </div>
      </div>
    </div>
  )
}

export const AnalyticsRevenueSkeletonDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBreakdownCard />
        <SkeletonChartCard height="h-[400px]" />
      </div>
      <SkeletonChartCard height="h-[300px]" />
    </div>
  )
}

export const AnalyticsStudentsSkeletonDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard height="h-[400px]" />
        <SkeletonChartCard height="h-[400px]" />
      </div>
      <SkeletonChartCard height="h-[300px]" />
    </div>
  )
}

export const AnalyticsContentSkeletonDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard height="h-[400px]" />
        <SkeletonChartCard height="h-[400px]" />
      </div>
      <SkeletonChartCard height="h-[300px]" />
    </div>
  )
}
