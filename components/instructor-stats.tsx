"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface InstructorStatsProps {
  creatorId?: string
}

interface Stats {
  totalCourses: number
  totalStudents: number
  memberSince: string
  following: number
}

export default function InstructorStats({ creatorId }: InstructorStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function fetchStats() {
      if (!creatorId) return

      try {
        const response = await fetch(`/api/users/${creatorId}/stats`)
        const data = await response.json()

        if (response.ok) {
          setStats(data.stats)
        }
      } catch (error) {
        console.error("Error fetching instructor stats:", error)
      }
    }

    fetchStats()
  }, [creatorId])

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="min-h-[100px]">
            <CardHeader className="p-4">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-2xl font-bold">{stats.totalCourses}</CardTitle>
          <CardDescription>Total Courses</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-2xl font-bold">{stats.totalStudents}</CardTitle>
          <CardDescription>Total Students</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-2xl font-bold">{new Date(stats.memberSince).getFullYear()}</CardTitle>
          <CardDescription>Member Since</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-2xl font-bold">{stats.following}</CardTitle>
          <CardDescription>Following</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
