"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { BookOpen, LayoutDashboard, LogOut, Upload, Video, Youtube } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { ThemeSwitch } from "@/components/theme-switch"
import { useEffect, useState } from "react"
import type { UserRole } from "@/lib/types"
import { useYouTubeStore } from "@/lib/store/youtube-store"

export function CreatorNavbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const userRole = (session?.user?.role as UserRole) || "STUDENT"
  const isAuthenticated = status === "authenticated"
  const [isMounted, setIsMounted] = useState(false)
  const { connected: youtubeConnected } = useYouTubeStore()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="border-b bg-background">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/creator" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6" />
            <span className="font-bold">EduPlatform</span>
          </Link>

          <div className="flex items-center space-x-1">
            <Link href="/dashboard/creator">
              <Button variant={isActive("/dashboard/creator") ? "default" : "ghost"} size="sm">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>

            <Link href="/dashboard/creator/content">
              <Button variant={isActive("/dashboard/creator/content") ? "default" : "ghost"} size="sm">
                <Video className="mr-2 h-4 w-4" />
                Content
              </Button>
            </Link>

            <Link href="/dashboard/creator/content/upload">
              <Button variant={isActive("/dashboard/creator/content/upload") ? "default" : "ghost"} size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </Link>

            <Link href="/dashboard/creator/service-connections">
              <Button
                variant={isActive("/dashboard/creator/service-connections") ? "default" : "ghost"}
                size="sm"
                className={youtubeConnected ? "text-green-500" : ""}
              >
                <Youtube className="mr-2 h-4 w-4" />
                {youtubeConnected ? "YouTube Connected" : "Connect YouTube"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />

          {isAuthenticated && (
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
