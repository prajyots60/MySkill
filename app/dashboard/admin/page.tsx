"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { BarChart, BookOpen, Flag, Search, Shield, Users } from "lucide-react"
import Link from "next/link"
import type { User } from "@/lib/types"

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalCreators: 0,
    flaggedContent: 0,
  })

  useEffect(() => {
    // Simulate API call with a timeout
    const timeout = setTimeout(() => {
      // Mock data
      setUsers([
        {
          id: "1",
          name: "John Doe",
          email: "john@example.com",
          role: "STUDENT",
          createdAt: new Date("2023-01-15"),
        },
        {
          id: "2",
          name: "Jane Smith",
          email: "jane@example.com",
          role: "CREATOR",
          createdAt: new Date("2023-02-20"),
        },
        {
          id: "3",
          name: "Alex Johnson",
          email: "alex@example.com",
          role: "STUDENT",
          createdAt: new Date("2023-03-10"),
        },
        {
          id: "4",
          name: "Sarah Williams",
          email: "sarah@example.com",
          role: "CREATOR",
          createdAt: new Date("2023-04-05"),
        },
        {
          id: "5",
          name: "Michael Brown",
          email: "michael@example.com",
          role: "STUDENT",
          createdAt: new Date("2023-05-12"),
        },
      ])

      setStats({
        totalUsers: 1245,
        totalCourses: 328,
        totalCreators: 87,
        flaggedContent: 3,
      })

      setLoading(false)
    }, 1500)

    return () => clearTimeout(timeout)
  }, [])

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    )
  })

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <Skeleton className="h-12 w-1/3 mb-6" />
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN")) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p className="mb-6">You don&apos;t have permission to access the admin dashboard.</p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Admin Control Panel</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-4 w-24 mt-1" /> : "+45 this week"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.totalCourses}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-4 w-24 mt-1" /> : "+12 this week"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.totalCreators}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-4 w-24 mt-1" /> : "+3 this week"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Flagged Content</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : stats.flaggedContent}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? <Skeleton className="h-4 w-24 mt-1" /> : "Requires attention"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">User Management</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="pl-8 w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-md border">
              <div className="p-4">
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "CREATOR" ? "default" : "secondary"}>
                            {user.role.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/admin/users/${user.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="content">
          <h2 className="text-xl font-semibold mb-6">Content Management</h2>

          <Card>
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>Review and manage content across the platform</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Content management features coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <h2 className="text-xl font-semibold mb-6">Platform Analytics</h2>

          <Card>
            <CardHeader>
              <CardTitle>Usage Metrics</CardTitle>
              <CardDescription>View platform-wide analytics and trends</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <BarChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Detailed analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
