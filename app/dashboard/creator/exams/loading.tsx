"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

export default function ExamsLoading() {
  return (
    <div className="container py-10 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        
        <Skeleton className="h-10 w-44" />
      </div>
      
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 p-4 rounded-xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 shimmer"></div>
        <div className="relative flex-1 max-w-md">
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="relative flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      
      {/* Tab navigation */}
      <div className="mt-4">
        <div className="border-b border-indigo-100 dark:border-indigo-900/30">
          <div className="flex mb-0 bg-transparent h-12 p-0 gap-2 overflow-x-auto">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
      
      {/* Grid view of exams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {Array(6).fill(0).map((_, index) => (
          <Card key={index} className="flex flex-col h-full border-indigo-100 dark:border-indigo-900/40 shadow-sm overflow-hidden relative">
            <div className="absolute inset-0 shimmer"></div>
            <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 border-b border-indigo-100 dark:border-indigo-900/30 relative">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="flex-grow text-sm pb-2 pt-4 relative">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0 mt-2 border-t border-indigo-100 dark:border-indigo-900/30 relative">
              <div className="flex justify-between w-full">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
