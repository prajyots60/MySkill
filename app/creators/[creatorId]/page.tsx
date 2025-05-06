import { Suspense } from "react"
import { Metadata, ResolvingMetadata } from "next"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { 
  CreatorHero, 
  CreatorTabs,
  CreatorFooter
} from "./components"
import { getCreatorProfile } from "./actions/get-creator"
import { getCreatorCourses } from "./actions/get-creator-courses"
import { OptimizedCourseCard } from "@/components/optimized-course-card"

// Define metadata for SEO
export async function generateMetadata(
  { params }: { params: { creatorId: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { creatorId } = await params
  // Fetch creator data
  const { creator } = await getCreatorProfile(creatorId)
  
  if (!creator) {
    return {
      title: "Creator not found",
      description: "The creator profile you're looking for doesn't exist"
    }
  }

  return {
    title: `${creator.name} - Creator Profile`,
    description: creator.bio?.substring(0, 160) || `Learn from ${creator.name} on our platform`,
    openGraph: {
      title: `${creator.name} - Creator Profile`,
      description: creator.bio?.substring(0, 160) || `Learn from ${creator.name} on our platform`,
      images: creator.image ? [creator.image] : undefined,
      type: 'profile',
      profile: {
        firstName: creator.name.split(' ')[0],
        lastName: creator.name.split(' ').slice(1).join(' '),
        username: creator.name.replace(/\s+/g, '').toLowerCase(),
      },
    },
  }
}

export default async function CreatorProfilePage({ 
  params 
}: { 
  params: { creatorId: string } 
}) {
  const { creatorId } = await params
  // Fetch creator data with SSR for SEO and initial render
  const { creator, success } = await getCreatorProfile(creatorId)
  
  if (!success || !creator) {
    notFound()
  }

  // Fetch creator courses server-side to ensure they persist across page refreshes
  const coursesData = await getCreatorCourses(creatorId)

  // Define theme color for the page
  const themeColor = creator.themeColor || "default"
  
  return (
    <div className="w-full">
      {/* Hero section with dynamic profile info - optimized with Server Components */}
      <Suspense fallback={<HeroSkeleton />}>
        <CreatorHero creator={creator} themeColor={themeColor} />
      </Suspense>
      
      {/* Main content with tabs - client component with suspense for content loading */}
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="space-y-6">
          <Suspense fallback={<TabsSkeleton />}>
            <CreatorTabs 
              creatorId={creatorId}
              themeColor={themeColor}
              creator={creator}
              coursesData={{
                courses: coursesData.courses,
                featuredCourses: coursesData.courses.slice(0, 3)
              }}
            />
          </Suspense>
        </div>
        
        {/* Footer - appears on all tabs */}
        <CreatorFooter creatorName={creator.name} themeColor={themeColor} />
      </div>
    </div>
  )
}

// Skeleton for hero section during loading
function HeroSkeleton() {
  return (
    <>
      <div className="h-64 w-full bg-gradient-to-b from-muted/20 to-background animate-pulse"></div>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row gap-8 items-start -mt-24">
          <div className="h-40 w-40 rounded-full border-4 border-background bg-muted animate-pulse" />
          <div className="flex-1 space-y-4 mt-10">
            <div className="h-12 w-64 bg-muted animate-pulse rounded" />
            <div className="h-5 w-full max-w-md bg-muted animate-pulse rounded" />
            <div className="h-5 w-full max-w-md bg-muted animate-pulse rounded" />
            <div className="flex gap-4">
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Skeleton for tabs section during loading
function TabsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-12 bg-muted animate-pulse rounded w-full max-w-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="h-80 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  )
}
