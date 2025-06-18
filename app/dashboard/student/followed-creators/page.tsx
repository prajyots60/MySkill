"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserCheck, UserMinus, PencilLine, GraduationCap, CalendarDays, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { useFollowData } from "@/hooks/use-follow-data"
import { cn } from "@/lib/utils"

interface FollowedInstructor {
  id: string
  name: string
  image?: string
  bio?: string
  courseCount: number
  followerCount: number
  joinedDate?: string
}

// Component to display the follower count with live updates
function FollowerCount({ creatorId, initialCount }: { creatorId: string, initialCount: number }) {
  const { followerCount } = useFollowData(creatorId);
  // Use the live count if available, otherwise use the initial count from the API
  const displayCount = followerCount !== null ? followerCount : initialCount;
  
  return (
    <span className="font-bold text-lg">{displayCount}</span>
  );
}

interface InstructorCardProps {
  instructor: FollowedInstructor;
  onUnfollow: (id: string) => void;
  isUnfollowing: boolean;
}

function InstructorCard({ instructor, onUnfollow, isUnfollowing }: InstructorCardProps) {
  // Use the useFollowData hook to get real-time follower data
  const { followerCount: liveFollowerCount } = useFollowData(instructor.id);
  
  // Use the live follower count if available, otherwise fall back to the API response
  const displayedFollowerCount = liveFollowerCount !== null ? liveFollowerCount : instructor.followerCount;

  return (
    <Card key={instructor.id} className="overflow-hidden group hover:shadow-md transition-all flex flex-col h-[380px]">
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={() => onUnfollow(instructor.id)}
          title="Unfollow"
          disabled={isUnfollowing}
        >
          <UserCheck className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 h-[100px] flex items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-4 border-background shadow-md">
            <AvatarImage src={instructor.image} alt={instructor.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {instructor.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-bold text-lg text-foreground">{instructor.name}</h3>
            <Link 
              href={`/creators/${instructor.id}`} 
              className="text-sm text-primary hover:underline flex items-center mt-1"
            >
              <PencilLine className="h-3 w-3 mr-1" /> View Profile
            </Link>
          </div>
        </div>
      </div>

      <CardContent className="pt-6 flex flex-col h-[180px]">
        <div className="min-h-[48px] mb-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {instructor.bio || "No bio available."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-auto">
          <div className="flex flex-col items-center p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-sm mb-1 text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Courses</span>
            </div>
            <span className="font-bold text-lg">{instructor.courseCount}</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-sm mb-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>Followers</span>
            </div>
            <span className="font-bold text-lg">{displayedFollowerCount}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-auto">
          <CalendarDays className="h-3 w-3" />
          <span>Member since {instructor.joinedDate ? format(new Date(instructor.joinedDate), 'MMMM yyyy') : 'N/A'}</span>
        </div>
      </CardContent>

      <div className="border-t p-4 flex justify-between items-center mt-auto">
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "text-xs bg-primary/10 text-primary border-0 hover:bg-primary/20",
            isUnfollowing && "opacity-70 pointer-events-none"
          )}
          onClick={() => onUnfollow(instructor.id)}
          disabled={isUnfollowing}
        >
          {isUnfollowing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Unfollowing...
            </>
          ) : (
            <>
              <UserMinus className="h-3.5 w-3.5 mr-1.5" />
              Unfollow
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/creators/${instructor.id}`}>
            View Courses
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export default function FollowedCreatorsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [followedInstructors, setFollowedInstructors] = useState<FollowedInstructor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [unfollowingCreators, setUnfollowingCreators] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        // Create a timestamp for cache-busting
        const cacheBustTimestamp = new Date().getTime().toString()
        const cacheBustHeaders = {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "X-Cache-Bust": cacheBustTimestamp
        }
        
        const instructorsResponse = await fetch("/api/student/followed-instructors", {
          headers: cacheBustHeaders
        })

        if (!instructorsResponse.ok) {
          throw new Error("Failed to fetch followed instructors")
        }

        const instructorsData = await instructorsResponse.json()
        setFollowedInstructors(instructorsData.instructors || [])
      } catch (err) {
        const error = err as Error
        console.error("Error fetching data:", error)
        setError(error.message || "Failed to fetch data")
        toast({
          title: "Error",
          description: error.message || "Failed to fetch data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session?.user])

  const handleUnfollow = async (creatorId: string) => {
    try {
      // Mark this creator as currently being unfollowed to show loading UI
      setUnfollowingCreators(prev => new Set([...prev, creatorId]))
      
      const response = await fetch(`/api/users/${creatorId}/follow`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to update follow status")
      }

      toast({
        title: "Creator unfollowed",
        description: "You have unfollowed this creator",
      })
      
      // Update the local state to remove the unfollowed instructor
      setFollowedInstructors(prev => prev.filter(instructor => instructor.id !== creatorId))
    } catch (err) {
      const error = err as Error
      console.error("Error unfollowing creator:", error)
      toast({
        title: "Action Failed",
        description: error.message || "Failed to unfollow creator",
        variant: "destructive",
      })
    } finally {
      // Remove the loading state for this creator
      setUnfollowingCreators(prev => {
        const updated = new Set([...prev])
        updated.delete(creatorId)
        return updated
      })
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[380px] w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Followed Creators
            </h1>
            <p className="text-lg text-muted-foreground">Stay updated with your favorite instructors and their latest courses.</p>
          </div>

          {followedInstructors.length === 0 ? (
            <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>No Followed Instructors</CardTitle>
                <CardDescription className="text-lg">
                  Follow your favorite instructors to stay updated with their latest courses.
                </CardDescription>
                <Button variant="outline" className="mt-4" onClick={() => router.push("/explore")}>
                  Find Instructors
                </Button>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {followedInstructors.map((instructor) => (
                <InstructorCard
                  key={instructor.id}
                  instructor={instructor}
                  onUnfollow={handleUnfollow}
                  isUnfollowing={unfollowingCreators.has(instructor.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
