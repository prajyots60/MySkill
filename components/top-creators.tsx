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
  bio: string
  image: string | null
  followers: number
  contentCount: number
}

export function TopCreators() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch all creators data
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true)
        // Fetch from our new API endpoint that gets all creators
        const response = await fetch("/api/creators/top", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch top creators")
        }

        const data = await response.json()
        
        if (data.success && Array.isArray(data.creators)) {
          setCreators(data.creators)
        } else {
          // Fallback if API doesn't return expected data structure
          throw new Error("Invalid data returned from API")
        }
      } catch (error) {
        console.error("Error fetching top creators:", error)
        toast({
          title: "Error",
          description: "Failed to load creators. Please try again later.",
          variant: "destructive",
        })
        // Set empty array when fetch fails
        setCreators([])
      } finally {
        setLoading(false)
      }
    }

    fetchCreators()
  }, [toast])

  return (
    <section className="py-12 px-4 md:px-6">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Top Creators</h2>
          <Button asChild variant="outline">
            <Link href="/explore?tab=creators">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-full">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Skeleton className="h-20 w-20 rounded-full mb-4" />
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : creators.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creators.map((creator) => (
              <Card key={creator.id} className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      <Avatar className="h-20 w-20 border-2 border-primary">
                        <AvatarImage src={creator.image || "/placeholder-user.jpg"} alt={creator.name} />
                        <AvatarFallback className="text-lg">{creator.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1">
                        <CheckCircle className="h-4 w-4" />
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-1">{creator.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {creator.bio || "Creator"}
                    </p>
                    
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{creator.followers.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Followers</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{creator.contentCount.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Courses</span>
                      </div>
                    </div>
                    
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                      <Link href={`/creators/${creator.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No Creators Found</h3>
            <p className="text-muted-foreground">Check back later for new creators.</p>
          </div>
        )}
      </div>
    </section>
  )
}