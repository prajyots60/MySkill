"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, CheckCircle, Users } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface Creator {
  id: string
  name: string
  role: string
  avatar: string
  studentCount: number
  courseCount: number
  categories: string[]
  verified: boolean
  rating: number
}

export function RecommendedCreators() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch real instructors data
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true)
        // Fetch from the existing student/recommended-instructors endpoint
        const response = await fetch("/api/student/recommended-instructors", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch recommended creators")
        }

        const data = await response.json()
        
        if (data.success && Array.isArray(data.instructors) && data.instructors.length > 0) {
          // Map the response data to match our Creator interface
          const mappedCreators = data.instructors.map((instructor: any) => ({
            id: instructor.id,
            name: instructor.name,
            role: instructor.bio?.split('\n')[0] || "Instructor",
            avatar: instructor.image || "/placeholder-user.jpg",
            studentCount: instructor.followers || 0,
            courseCount: instructor.courseCount || 0,
            categories: [],
            verified: true,
            rating: 4.5, // Default rating as it's not in the API response
          }));
          
          setCreators(mappedCreators)
        } else {
          // Fallback if API doesn't return expected data structure
          throw new Error("Invalid data returned from API")
        }
      } catch (error) {
        console.error("Error fetching recommended creators:", error)
        
        // Set empty array when fetch fails
        setCreators([])
      } finally {
        setLoading(false)
      }
    }

    fetchCreators()
  }, [toast])

  // Helper function to truncate bio text
  const truncateBio = (bio: string, maxLength: number = 25) => {
    if (!bio) return "";
    if (bio.length <= maxLength) return bio;
    return bio.substring(0, maxLength) + "...";
  }

  return (
    <Card className="h-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recommended Instructors</CardTitle>
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
                </div>
              </div>
            ))}
          </div>
        ) : creators.length > 0 ? (
          <div className="max-h-[250px] overflow-y-auto">
            {creators.map((creator) => (
              <Link 
                key={creator.id}
                href={`/creators/${creator.id}`}
                className="block p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border border-muted">
                      <AvatarImage src={creator.avatar} alt={creator.name} />
                      <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {creator.verified && (
                      <span className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5">
                        <CheckCircle className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm truncate">{creator.name}</h4>
                        <p className="text-xs text-muted-foreground">{truncateBio(creator.role)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{creator.studentCount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span>⭐ {creator.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recommended instructors</p>
          </div>
        )}
      </CardContent>
      {creators.length > 0 && (
        <div className="p-4 pt-0">
          <Button asChild variant="link" size="sm" className="w-full gap-1">
            <Link href="/explore?tab=creators">
              View All Instructors
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  )
}
