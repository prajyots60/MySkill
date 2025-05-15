"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  Upload,
  Video,
  Shield,
  Youtube,
  Library,
  Bookmark,
  DollarSign,
  Users,
  Calendar,
  GraduationCap,
  FileQuestion,
  BarChart,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { ThemeSwitch } from "@/components/theme-switch"
import { useEffect, useState } from "react"
import type { UserRole } from "@/lib/types"
import { useYouTubeStore } from "@/lib/store/youtube-store"

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const userRole = (session?.user?.role as UserRole) || "STUDENT"
  const isAuthenticated = status === "authenticated"
  const { state } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)

  // Use our YouTube store
  const { connected: youtubeConnected, checkConnectionStatus } = useYouTubeStore()

  // Avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Check YouTube connection status
  useEffect(() => {
    if (isAuthenticated && (userRole === "CREATOR" || userRole === "ADMIN")) {
      checkConnectionStatus()
    }
  }, [isAuthenticated, userRole, checkConnectionStatus])

  // Strict path matching to ensure only current page is highlighted
  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/"
    }
    
    // Exact path matching to prevent multiple highlights
    return pathname === path
  }

  // Hide the sidebar completely during authentication loading
  if (status === "loading") {
    return null;
  }

  return (
    <Sidebar collapsible="icon" className="sidebar-modern">
      <SidebarHeader className="flex flex-col gap-0.5 py-1.5">
        <div className="flex items-center justify-center px-1.5">
          <Link href={isAuthenticated ? getDefaultDashboardPath(userRole) : "/"} className="flex items-center gap-1">
            <Video className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-[13px] text-primary group-data-[collapsible=icon]:hidden">EduTube</span>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-0.5">
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeSwitch />
          </div>
          {isMounted && (
            <SidebarTrigger className="text-primary h-8 w-8 p-1">
              {state === "expanded" ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </SidebarTrigger>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-1">
        {/* Public navigation - only show when not authenticated */}
        {!isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] px-1">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/")}
                    tooltip="Home"
                    className="group-data-[collapsible=icon]:justify-center"
                  >
                    <Link href="/">
                      <BookOpen className="h-4 w-4" />
                      <span className="text-[13px]">Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/explore")}
                    tooltip="Explore"
                    className="group-data-[collapsible=icon]:justify-center"
                  >
                    <Link href="/explore">
                      <Library className="h-4 w-4" />
                      <span className="text-[13px]">Explore</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAuthenticated && (
          <>
            {/* Student Dashboard - only for students */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] px-1">Learning</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/explore")}
                      tooltip="Explore"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/explore">
                        <Library className="h-4 w-4" />
                        <span className="text-[13px]">Explore</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/dashboard/student")}
                      tooltip="Dashboard"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/dashboard/student">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="text-[13px]">Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/dashboard/student/my-courses")}
                      tooltip="My Courses"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/dashboard/student/my-courses">
                        <BookOpen className="h-4 w-4" />
                        <span className="text-[13px]">My Courses</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/dashboard/student/saved")}
                      tooltip="Saved"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/dashboard/student/saved">
                        <Bookmark className="h-4 w-4" />
                        <span className="text-[13px]">Saved</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/dashboard/student/calendar")}
                      tooltip="Calendar"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/dashboard/student/calendar">
                        <Calendar className="h-4 w-4" />
                        <span className="text-[13px]">Calendar</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/dashboard/student/exams")}
                      tooltip="Exams"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href="/dashboard/student/exams">
                        <FileQuestion className="h-4 w-4" />
                        <span className="text-[13px]">Exams</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Add separator before Creator Tools */}
            {(userRole === "CREATOR" || userRole === "ADMIN") && (
              <SidebarSeparator className="my-2" />
            )}

            {/* Creator Dashboard - only for creators and admins */}
            {(userRole === "CREATOR" || userRole === "ADMIN") && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[11px] px-1">Creator Tools</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator")}
                        tooltip="Creator Dashboard"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator">
                          <LayoutDashboard className="h-4 w-4" />
                          <span className="text-[13px]">Creator Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/content/create")}
                        tooltip="Create Course"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/content/create">
                          <PlusCircle className="h-4 w-4" />
                          <span className="text-[13px]">Create Course</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/content/upload")}
                        tooltip="Upload Content"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/content/upload">
                          <Upload className="h-4 w-4" />
                          <span className="text-[13px]">Upload Content</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/exams")}
                        tooltip="Manage Exams"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/exams">
                          <FileQuestion className="h-4 w-4" />
                          <span className="text-[13px]">Manage Exams</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/service-connections")}
                        tooltip="Connected Services"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link
                          href="/dashboard/creator/service-connections"
                          className={!youtubeConnected ? "text-primary" : ""}
                        >
                          <Youtube className="h-4 w-4" />
                          <span className="text-[13px]">Connected Services </span>
                          {!youtubeConnected && (
                            <span className="ml-1 h-2 w-2 rounded-full bg-primary group-data-[collapsible=icon]:hidden"></span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/students")}
                        tooltip="Manage Students"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/students">
                          <Users className="h-4 w-4" />
                          <span className="text-[13px]">Manage Students</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/earnings")}
                        tooltip="Earnings & Payouts"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/earnings">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-[13px]">Earnings & Payouts</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/calendar")}
                        tooltip="Calendar"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/calendar">
                          <Calendar className="h-4 w-4" />
                          <span className="text-[13px]">Calendar</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/add-student")}
                        tooltip="Add Student"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/add-student">
                          <Users className="h-4 w-4" />
                          <span className="text-[13px]">Add Student</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/creator/analytics")}
                        tooltip="Analytics"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/creator/analytics">
                          <BarChart className="h-4 w-4" />
                          <span className="text-[13px]">Analytics</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Admin Dashboard - only for admins */}
            {userRole === "ADMIN" && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[11px] px-1">Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/admin")}
                        tooltip="Admin Panel"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Link href="/dashboard/admin">
                          <Shield className="h-4 w-4" />
                          <span className="text-[13px]">Admin Panel</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-1 mt-auto">
        {isAuthenticated ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 px-1 pl-1.5 py-0.5 mb-0.5 rounded-md bg-sidebar-accent/10">
              <Avatar className="h-6 w-6 shrink-0 border border-primary/10">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User"} />
                <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="text-[13px] font-medium text-primary truncate">{session?.user?.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize truncate">{userRole.toLowerCase()}</span>
              </div>
            </div>

            {/* Footer buttons in a row for expanded state */}
            <div className="grid grid-cols-2 gap-0.5 w-full group-data-[collapsible=icon]:block">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="flex-col items-center justify-center h-auto py-0.5 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-6"
              >
                <Link href={userRole === "CREATOR" ? "/dashboard/creator/settings" : "/settings"} className="flex flex-col items-center">
                  <Settings className="h-4 w-4 mb-0.5" />
                  <span className="text-[11px] group-data-[collapsible=icon]:hidden">Settings</span>
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex-col items-center justify-center h-auto py-0.5 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:mt-0.5"
              >
                <div className="flex flex-col items-center">
                  <LogOut className="h-4 w-4 mb-0.5" />
                  <span className="text-[11px] group-data-[collapsible=icon]:hidden">Sign out</span>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0.5 w-full group-data-[collapsible=icon]:block">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex-col items-center justify-center h-auto py-0.5 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-6"
            >
              <Link href="/auth/signin" className="flex flex-col items-center">
                <LogOut className="h-4 w-4 mb-0.5" />
                <span className="text-[11px] group-data-[collapsible=icon]:hidden">Sign in</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex-col items-center justify-center h-auto py-0.5 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:mt-0.5"
            >
              <Link href="/auth/signup" className="flex flex-col items-center">
                <PlusCircle className="h-4 w-4 mb-0.5" />
                <span className="text-[11px] group-data-[collapsible=icon]:hidden">Sign up</span>
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

// Helper function to get the default dashboard path based on user role
function getDefaultDashboardPath(role: UserRole): string {
  switch (role) {
    case "CREATOR":
      return "/dashboard/creator"
    case "ADMIN":
    case "STUDENT":
    default:
      return "/dashboard/student"
  }
}
