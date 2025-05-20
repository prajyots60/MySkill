"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { BookOpen, Calendar, LayoutDashboard, Library, Menu, Upload, DollarSign } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

export function MobileNavigation() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { data: session, status } = useSession()
  const { openMobile, setOpenMobile } = useSidebar()
  const isAuthenticated = status === "authenticated"
  const userRole = session?.user?.role || "STUDENT"
  const [isMounted, setIsMounted] = useState(false)
  const [prevScrollPos, setPrevScrollPos] = useState(0)
  const [visible, setVisible] = useState(true)

  // Avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Handle scroll behavior to hide/show navbar on scroll
  useEffect(() => {
    if (!isMounted || !isMobile) return

    const handleScroll = () => {
      const currentScrollPos = window.scrollY
      
      // Show navbar if:
      // 1. User is scrolling up
      // 2. User is near the top of the page (< 10px)
      // 3. User has scrolled to the bottom of the page
      const isScrollingUp = prevScrollPos > currentScrollPos
      const isNearTop = currentScrollPos < 10
      
      // Check if user is at bottom of page
      const isNearBottom = window.innerHeight + window.scrollY >= 
        document.documentElement.scrollHeight - 100
      
      const shouldBeVisible = isScrollingUp || isNearTop || isNearBottom

      setPrevScrollPos(currentScrollPos)
      if (shouldBeVisible !== visible) {
        setVisible(shouldBeVisible)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMounted, isMobile, prevScrollPos, visible])

  // Don't render anything during SSR
  if (!isMounted) return null

  // Don't render if not on mobile
  if (!isMobile) return null

  // Don't render if not authenticated
  if (!isAuthenticated) return null

  // Don't render if sidebar is open
  if (openMobile) return null

  // Navigation items based on user role
  const studentNavItems = [
    {
      label: "Explore",
      href: "/explore",
      icon: Library,
      ariaLabel: "Browse courses",
      roles: ["STUDENT", "ADMIN"]
    },
    {
      label: "Dashboard",
      href: "/dashboard/student",
      icon: LayoutDashboard,
      ariaLabel: "Student dashboard",
      roles: ["STUDENT", "ADMIN"]
    },
    {
      label: "My Courses",
      href: "/dashboard/student/my-courses",
      icon: BookOpen,
      ariaLabel: "View my courses",
      roles: ["STUDENT", "ADMIN"]
    },
    {
      label: "Calendar",
      href: "/dashboard/student/calendar",
      icon: Calendar,
      ariaLabel: "View calendar",
      roles: ["STUDENT", "ADMIN"]
    },
  ]

  const creatorNavItems = [
    {
      label: "Dashboard",
      href: "/dashboard/creator",
      icon: LayoutDashboard,
      ariaLabel: "Creator dashboard",
      roles: ["CREATOR", "ADMIN"]
    },
    {
      label: "Upload",
      href: "/dashboard/creator/courses/create",
      icon: Upload,
      ariaLabel: "Upload content",
      roles: ["CREATOR", "ADMIN"]
    },
    {
      label: "Earnings",
      href: "/dashboard/creator/earnings",
      icon: DollarSign,
      ariaLabel: "Earnings and payouts",
      roles: ["CREATOR", "ADMIN"]
    },
    {
      label: "Calendar",
      href: "/dashboard/creator/calendar",
      icon: Calendar,
      ariaLabel: "Creator calendar",
      roles: ["CREATOR", "ADMIN"]
    },
  ]

  // Select the appropriate navigation items based on role
  const navItems = userRole === "CREATOR" ? creatorNavItems : studentNavItems

  // Check if a path is active
  const isActive = (path: string) => {
    // Exact path matching for root pages
    if (path === "/explore" || path === "/dashboard/student" || path === "/dashboard/creator") {
      return pathname === path
    }
    
    // Special case for upload content
    if (path === "/dashboard/creator/courses/create" && 
        (pathname.startsWith("/dashboard/creator/courses/create") || 
         pathname.includes("/upload"))) {
      return true
    }
    
    // Special case for earnings
    if (path === "/dashboard/creator/earnings" && 
        (pathname.startsWith("/dashboard/creator/earnings") || 
         pathname.includes("/payout"))) {
      return true
    }
    
    // For other pages, check if the pathname starts with the path
    return pathname.startsWith(path)
  }

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 block md:hidden",
        "transition-transform duration-300 ease-in-out",
        "mobile-nav-container", // Added class for additional styling
        !visible && "translate-y-full",
        userRole === "CREATOR" && "creator-nav-theme"
      )}
      role="navigation"
      aria-label={userRole === "CREATOR" ? "Creator mobile navigation" : "Mobile navigation"}
    >
      <nav className="h-14 border-t bg-background flex items-center justify-around shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
        {/* Menu button to open sidebar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex flex-col items-center justify-center h-full px-2 text-xs border-r border-border/50",
            userRole === "CREATOR" && "creator-menu-button"
          )}
          aria-label="Open menu"
        >
          <Menu className="h-[18px] w-[18px] mb-0.5 text-primary" />
          <span className="text-[11px] font-semibold">{userRole === "CREATOR" ? "Creator" : "Menu"}</span>
        </Button>

        {/* Navigation items */}
        {navItems.map((item) => {
          const active = isActive(item.href)
          const isCreatorItem = item.href.includes("/dashboard/creator/")
          const isStudentItem = item.href.includes("/dashboard/student/") || item.href === "/explore"
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center relative flex-1 h-full px-2 text-xs transition-colors",
                active
                  ? "text-primary font-bold bg-primary/15 dark:bg-primary/20 nav-item-active"
                  : "text-foreground hover:text-primary hover:bg-muted/70 dark:hover:bg-muted/40",
                isCreatorItem && "mobile-nav-creator-item",
                isStudentItem && "mobile-nav-student-item"
              )}
              aria-label={item.ariaLabel}
              aria-current={active ? "page" : undefined}
            >
              <span 
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity",
                  active && "opacity-10"
                )}
                aria-hidden="true"
              >
                <item.icon className="h-12 w-12" />
              </span>
              <item.icon className="h-[18px] w-[18px] mb-0.5" />
              <span className="text-[11px] font-semibold">{item.label}</span>
              {active && (
                <span 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" 
                  aria-hidden="true"
                />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
