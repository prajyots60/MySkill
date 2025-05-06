"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, Calendar, CheckCircle, Clock, FileText, Video, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type NotificationType = "announcement" | "assignment" | "live" | "feedback" | "reminder"

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  courseId: string
  courseName: string
  createdAt: Date
  read: boolean
  actionUrl?: string
  dueDate?: Date
}

export function StudentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const timeout = setTimeout(() => {
      const mockNotifications: Notification[] = [
        {
          id: "1",
          type: "announcement",
          title: "New course materials available",
          message: "Check out the new resources added to the Web Development course.",
          courseId: "1",
          courseName: "Web Development Fundamentals",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          read: false,
          actionUrl: "/content/1",
        },
        {
          id: "2",
          type: "live",
          title: "Live Q&A Session Today",
          message: "Join the live Q&A session with John Doe at 3:00 PM.",
          courseId: "1",
          courseName: "Web Development Fundamentals",
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          read: false,
          actionUrl: "/content/1/live",
        },
        {
          id: "3",
          type: "assignment",
          title: "Assignment Due Soon",
          message: "Your JavaScript Basics assignment is due in 2 days.",
          courseId: "1",
          courseName: "Web Development Fundamentals",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          read: true,
          actionUrl: "/content/1/assignments",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        },
        {
          id: "4",
          type: "feedback",
          title: "Feedback Received",
          message: "Your instructor has provided feedback on your recent project.",
          courseId: "2",
          courseName: "Data Science for Beginners",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          read: true,
          actionUrl: "/content/2/feedback",
        },
      ]

      setNotifications(mockNotifications)
      setLoading(false)
    }, 1500)

    return () => clearTimeout(timeout)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "announcement":
        return <Bell className="h-5 w-5 text-blue-500" />
      case "assignment":
        return <FileText className="h-5 w-5 text-amber-500" />
      case "live":
        return <Video className="h-5 w-5 text-red-500" />
      case "feedback":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "reminder":
        return <Clock className="h-5 w-5 text-purple-500" />
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    return `${Math.floor(diffInSeconds / 86400)} days ago`
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Notifications</CardTitle>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors ${
                  !notification.read ? "bg-muted/30" : ""
                }`}
              >
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => dismissNotification(notification.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{notification.courseName}</span>
                    {notification.dueDate && (
                      <div className="flex items-center text-xs text-amber-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>Due {notification.dueDate.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={() => markAsRead(notification.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
