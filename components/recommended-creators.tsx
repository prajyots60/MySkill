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
        
        // First, fetch the instructors the user is already following
        const followingResponse = await fetch("/api/student/followed-instructors", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch((err) => {
          console.error("Error fetching followed instructors:", err);
          return null;
        });
        
        // Get IDs of instructors already being followed
        let followingIds: string[] = [];
        if (followingResponse?.ok) {
          const followingData = await followingResponse.json();
          console.log("Followed instructors data:", followingData);
          
          // Extract instructor IDs based on the response structure
          if (followingData.success && Array.isArray(followingData.instructors)) {
            followingIds = followingData.instructors.map((instructor: any) => instructor.id);
          }
        }
        
        console.log("Already following instructor IDs:", followingIds);
        
        // Fetch recommended instructors
        const response = await fetch("/api/student/recommended-instructors?limit=10", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch recommended instructors");
        }

        const data = await response.json();
        // console.log("All recommended instructors data:", data);
        
        if (data.success && Array.isArray(data.instructors) && data.instructors.length > 0) {
          // console.log("Raw recommended instructors:", data.instructors.map((i: any) => ({ id: i.id, name: i.name })));
          
          // Map the response data to match our Creator interface
          let mappedCreators = data.instructors
            // Only include instructors the user is NOT already following
            .filter((instructor: any) => !followingIds.includes(instructor.id))
            .map((instructor: any) => ({
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
            
            // Define interface for the logged creator summary
            interface CreatorSummary {
            id: string;
            name: string;
            }
            
            // console.log("Filtered instructors (not following):", mappedCreators.map((c: Creator): CreatorSummary => ({ id: c.id, name: c.name })));
          
          // Limit to at most 2 recommended creators
          mappedCreators = mappedCreators.slice(0, 2);
            console.log("Final recommended instructors (limited to 2):", mappedCreators.map((c: Creator): CreatorSummary => ({ id: c.id, name: c.name })));
          
          setCreators(mappedCreators);
        } else {
          // Fallback if API doesn't return expected data structure
          console.log("No instructors returned from API or unexpected data structure");
          setCreators([]);
        }
      } catch (error) {
        console.error("Error fetching recommended creators:", error);
        setCreators([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCreators();
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
