"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Eye, Star, UserPlus, UserCheck } from "lucide-react"
import SocialLinks from "./SocialLinks"
import { CreatorProfile } from "../actions/get-creator"
import { themePresets } from "../utils/themePresets"
import { useToast } from "@/hooks/use-toast"
import { useLocalStorageWithExpiry } from "@/hooks/use-local-storage"
import { useSession } from "next-auth/react"
import { useFollowData } from "@/hooks/use-follow-data"

interface CreatorHeroProps {
  creator: CreatorProfile;
  themeColor: string;
}

const CreatorHero: React.FC<CreatorHeroProps> = ({ creator, themeColor }) => {
  const currentTheme = themePresets[themeColor as keyof typeof themePresets] || themePresets.default;
  const { toast } = useToast()
  const { data: session } = useSession()
  
  // Use our new centralized hook for follower data
  const { followerCount, isFollowing, isLoading: isLoadingFollow, toggleFollow } = useFollowData(creator.id)

  // Handle follow/unfollow with our new hook
  const handleFollowToggle = async () => {
    if (!session?.user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to follow this creator",
      })
      return
    }
    
    try {
      const result = await toggleFollow()
      
      if (result) {
        toast({
          title: result.isFollowing ? "Following!" : "Unfollowed",
          description: result.isFollowing 
            ? `You are now following ${creator.name}`
            : `You are no longer following ${creator.name}`,
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Error toggling follow status:", error)
      toast({
        title: "Error",
        description: "Unable to update follow status. Please try again later.",
        variant: "destructive",
      })
    }
  }

  // Use creator's uploaded cover images if available, otherwise use demo images
  const defaultImages = [
    "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?q=80&w=1674&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=1674&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1770&auto=format&fit=crop"
  ];
  
  // If creator has uploaded cover images, use those; otherwise use default images
  const images = creator.coverImages && creator.coverImages.length > 0 
    ? creator.coverImages 
    : defaultImages;
  
  // Carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [nextImageIndex, setNextImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Full image view state
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    // Only setup the interval if we have multiple images
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      // Set the next image index
      const next = (currentImageIndex + 1) % images.length;
      setNextImageIndex(next);
      
      // Start the transition
      setIsTransitioning(true);
      
      // After transition completes, update current image
      setTimeout(() => {
        setCurrentImageIndex(next);
        setIsTransitioning(false);
      }, 1000); // Match this with CSS transition duration
      
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [images.length, currentImageIndex]);

  // Function to manually change image
  const changeImage = (index: number) => {
    if (index === currentImageIndex) return;
    
    setNextImageIndex(index);
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentImageIndex(index);
      setIsTransitioning(false);
    }, 1000); // Match this with CSS transition duration
  };

  return (
    <>
      {/* Hero section with carousel background */}
      <div className={`w-full relative bg-gradient-to-b ${currentTheme.heroBg} pt-20 pb-32 overflow-hidden`}>
        {/* Eye Icon for Full Image View - More visible and prominent */}
        <button 
          onClick={() => setShowFullImage(true)}
          className="absolute top-6 right-6 z-30 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-all duration-300 backdrop-blur-md shadow-lg"
          aria-label="View full cover image"
        >
          <Eye size={24} strokeWidth={2} />
        </button>
        
        {/* Carousel layers */}
        {images.map((image, index) => (
          <div
            key={index}
            className="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.3)), url(${image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 
                index === currentImageIndex 
                  ? 1 
                  : (index === nextImageIndex && isTransitioning)
                    ? 1
                    : 0,
              zIndex: index === currentImageIndex ? 1 : (index === nextImageIndex && isTransitioning) ? 2 : 0,
            }}
          />
        ))}
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          {creator.institutionName && (
            <div className="flex justify-center mb-4">
              <Badge 
                variant="outline" 
                className="backdrop-blur-sm bg-black/30 text-white border-white/20 px-4 py-1 text-sm"
              >
                {creator.institutionName}
              </Badge>
            </div>
          )}
          
          <div className="text-center space-y-4 relative z-10">
            <h1 className={`text-4xl md:text-5xl font-bold ${images.length > 0 ? 'text-white' : ''}`}>
              {creator.customTitle || `Welcome to ${creator.name}'s Academy`}
              {creator.verified && (
                <span className="inline-flex items-center ml-2 text-blue-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
              )}
            </h1>
            {creator.tagline && (
              <p className={`text-xl ${images.length > 0 ? 'text-white/90' : 'text-muted-foreground'} max-w-3xl mx-auto`}>
                {creator.tagline}
              </p>
            )}
            
            <div className="flex justify-center gap-3 mt-6">
              <Button 
                className={`bg-${themeColor !== 'default' ? themeColor + '-500' : 'primary'} hover:bg-${themeColor !== 'default' ? themeColor + '-600' : 'primary/90'} text-white`}
                onClick={() => document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Browse Courses
              </Button>
              <Button 
                variant="outline" 
                className={images.length > 0 ? 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20' : ''}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact
              </Button>
            </div>

            {/* Stats banner */}
            <div className="flex flex-wrap justify-center gap-8 mt-8">
              <div className={`text-center ${images.length > 0 ? 'text-white' : ''}`}>
                <div className="text-3xl font-bold">{creator.courseCount || 0}</div>
                <div className={`text-sm ${images.length > 0 ? 'text-white/80' : 'text-muted-foreground'}`}>Courses</div>
              </div>
              <div className={`text-center ${images.length > 0 ? 'text-white' : ''}`}>
                <div className="text-3xl font-bold">
                  {creator.studentCount || 0}
                </div>
                <div className={`text-sm ${images.length > 0 ? 'text-white/80' : 'text-muted-foreground'}`}>Students</div>
              </div>
              <div className={`text-center ${images.length > 0 ? 'text-white' : ''}`}>
                <div className="text-3xl font-bold flex items-center justify-center">
                  4.8
                  <Star className="h-4 w-4 ml-1 text-yellow-400 fill-yellow-400" />
                </div>
                <div className={`text-sm ${images.length > 0 ? 'text-white/80' : 'text-muted-foreground'}`}>Rating</div>
              </div>
              <div className={`text-center ${images.length > 0 ? 'text-white' : ''}`}>
                <div className="text-3xl font-bold">{creator.yearsTeaching || "5+"}</div>
                <div className={`text-sm ${images.length > 0 ? 'text-white/80' : 'text-muted-foreground'}`}>Years Teaching</div>
              </div>
            </div>
            
            {/* Carousel indicators */}
            {images.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => changeImage(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === currentImageIndex 
                        ? 'bg-white scale-110' 
                        : 'bg-white/40 hover:bg-white/60'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Floating profile card */}
      <div className="container mx-auto px-4 md:px-6 relative z-20">
        <div className="flex flex-col items-center lg:flex-row lg:items-start gap-6 -mt-24 mb-12">
          <div className={`${currentTheme.cardBg} rounded-xl shadow-lg p-6 flex flex-col lg:flex-row items-center gap-6 w-full relative z-20`}>
            <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
              <AvatarImage src={creator.image || ""} alt={creator.name || "Creator"} />
              <AvatarFallback className="text-4xl">
                {creator.name?.charAt(0) || <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {creator.name || "Creator"}
                    {creator.verified && (
                      <span className="inline-flex items-center ml-2 text-blue-500">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center justify-center lg:justify-start gap-3 mt-2 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
                      </svg>
                      <span>{creator.expertise && creator.expertise.length > 0 ? creator.expertise[0] : "Expert Educator"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                        <line x1="16" x2="16" y1="2" y2="6"/>
                        <line x1="8" x2="8" y1="2" y2="6"/>
                        <line x1="3" x2="21" y1="10" y2="10"/>
                      </svg>
                      <span>Since {new Date(creator.createdAt).getFullYear()}</span>
                    </div>
                  </div>
                  
                  {/* Location, Language, Categories */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-3">
                    {creator.location && (
                      <div className="flex items-center gap-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>{creator.location}</span>
                      </div>
                    )}
                    
                    {creator.languages && creator.languages.length > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          <path d="M2 12h20"/>
                        </svg>
                        <span>{creator.languages.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  
                  {creator.categories && creator.categories.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-3">
                      {creator.categories.map((category, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs py-0">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Action buttons - Follow/Unfollow or Edit Profile */}
                <div className="flex gap-2 mt-4 lg:mt-0">
                  {creator.isOwnProfile ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/creator/settings">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          Edit Profile
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href="/dashboard/creator">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M5 12h14"/>
                            <path d="m12 5 7 7-7 7"/>
                          </svg>
                          Dashboard
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        className={isFollowing ? "bg-transparent hover:bg-primary/10" : `bg-${themeColor !== 'default' ? themeColor + '-500' : 'primary'} hover:bg-${themeColor !== 'default' ? themeColor + '-600' : 'primary/90'}`}
                        variant={isFollowing ? "outline" : "default"}
                        size="sm"
                        onClick={handleFollowToggle}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Follow
                          </>
                        )}
                      </Button>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <span className="font-medium mr-1">{followerCount}</span>
                        <span>{followerCount === 1 ? 'follower' : 'followers'}</span>
                      </div>
                      <Button variant="outline" size="sm">
                        <Mail className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {creator.bio && (
                <p className="mt-4 text-muted-foreground line-clamp-2">{creator.bio}</p>
              )}
              
              <div className="mt-4 flex justify-center lg:justify-start">
                <SocialLinks 
                  links={creator.socialLinks} 
                  theme={creator.coverImage ? "outline" : "default"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Full Image View Modal */}
      {showFullImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setShowFullImage(false)}>
          <div className="relative w-full h-full max-w-7xl max-h-screen p-4 flex flex-col">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowFullImage(false);
              }}
              className="absolute top-4 right-4 z-20 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full"
              aria-label="Close full image view"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            {/* Image carousel in full-screen view */}
            <div className="relative flex-1 overflow-hidden">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                  style={{
                    opacity: index === currentImageIndex ? 1 : 0,
                  }}
                >
                  <img 
                    src={image} 
                    alt={`Cover image ${index + 1}`} 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ))}
              
              {/* Navigation controls for carousel in full view */}
              {images.length > 1 && (
                <>
                  <button 
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      const prevIndex = (currentImageIndex - 1 + images.length) % images.length;
                      changeImage(prevIndex);
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button 
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextIndex = (currentImageIndex + 1) % images.length;
                      changeImage(nextIndex);
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Carousel indicators */}
            {images.length > 1 && (
              <div className="flex justify-center gap-3 mt-4">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      changeImage(index);
                    }}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentImageIndex 
                        ? 'bg-white scale-110' 
                        : 'bg-white/40 hover:bg-white/60'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default CreatorHero