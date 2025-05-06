"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Share2, ChevronDown, Star, UserPlus, BookOpen, MoveRight, Video } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCreatorPublicCourses } from "@/lib/react-query/queries"
import CourseCard from "./CourseCard"
import LiveSessions from "./LiveSessions"
import QuestionsList from "./QuestionsList"
import CreatorMilestones from "./CreatorMilestones"
import CreatorResources from "./CreatorResources"
import Testimonials from "./Testimonials"
import CustomSections from "./CustomSections"
import { getCreatorProfile } from "../actions/get-creator"
import { MockCoursesData, ExtendedCourse } from "../types/creator.types"

interface CreatorTabsProps {
  creatorId: string;
  themeColor: string;
  // Optional props to be backward compatible
  creator?: any;
  coursesData?: MockCoursesData;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const CreatorTabs: React.FC<CreatorTabsProps> = ({
  creatorId,
  themeColor,
  creator: propCreator,
  coursesData: propCoursesData,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Get tab from URL or default to "overview"
  const tabParam = searchParams.get("tab")
  
  const [creator, setCreator] = useState<any>(propCreator)
  const [isLoading, setIsLoading] = useState(!propCreator)
  const [activeTab, setActiveTab] = useState<string>(propActiveTab || tabParam || "overview")
  const [coursesData, setCoursesData] = useState<MockCoursesData>(propCoursesData || { 
    courses: [], 
    featuredCourses: [],
    pagination: {
      total: 0,
      totalPages: 0,
      currentPage: 1,
      perPage: 12
    }
  })
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)
  const [courseTypeFilter, setCourseTypeFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  // Fetch creator data if not provided as prop
  useEffect(() => {
    if (!propCreator) {
      const fetchCreator = async () => {
        setIsLoading(true)
        try {
          const { creator: fetchedCreator, success } = await getCreatorProfile(creatorId)
          if (success && fetchedCreator) {
            setCreator(fetchedCreator)
          }
        } catch (error) {
          console.error("Failed to fetch creator:", error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchCreator()
    }
  }, [creatorId, propCreator])

  // Fetch creator courses using React Query but only if we don't have prop data
  const { data: creatorCoursesData, isLoading: isLoadingCourses } = useCreatorPublicCourses(
    creatorId,
    page,
    12, // Limit per page
    selectedTag,
    { enabled: !propCoursesData?.courses?.length } // Only run query if we don't have server data
  );
  
  // Add debug logging to track data sources
  useEffect(() => {
    console.log("Server-side courses data:", propCoursesData);
    console.log("Client-side fetched courses data:", creatorCoursesData);
  }, [propCoursesData, creatorCoursesData]);
  
  // Update coursesData when courses are fetched - prioritize server-side data
  useEffect(() => {
    // If we have server-side data (from props), use that and don't overwrite
    if (propCoursesData?.courses?.length) {
      console.log("Using server-provided courses data");
      setCoursesData(propCoursesData);
      return;
    }
    
    // Otherwise, use client-side fetched data if available
    if (creatorCoursesData && creatorCoursesData.courses) {
      console.log("Using client-side fetched courses data");
      // Ensure courses is always an array before using array methods
      const coursesArray = Array.isArray(creatorCoursesData.courses) 
        ? creatorCoursesData.courses 
        : [];
      
      setCoursesData(prev => ({
        ...prev,
        courses: coursesArray,
        // Mark first 3 courses as featured if we don't have explicit featured courses
        featuredCourses: prev.featuredCourses && prev.featuredCourses.length > 0 
          ? prev.featuredCourses 
          : coursesArray.length > 0 ? coursesArray.slice(0, 3) : []
      }));
    }
  }, [propCoursesData, creatorCoursesData]);

  // Handle tab change
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    if (propSetActiveTab) {
      propSetActiveTab(value)
    } else {
      // Update URL with tab parameter for better sharing/SEO
      const params = new URLSearchParams(searchParams.toString())
      if (value === "overview") {
        params.delete("tab")
      } else {
        params.set("tab", value)
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`
      router.push(newUrl, { scroll: false })
    }
  }, [router, searchParams, propSetActiveTab])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedTag, searchQuery, courseTypeFilter])

  // Extract unique tags from courses
  const uniqueTags = useMemo(() => {
    if (!coursesData?.courses || !Array.isArray(coursesData.courses)) {
      return [];
    }
    
    return coursesData.courses.reduce((tags: string[], course: ExtendedCourse) => {
      course.tags?.forEach((tag: string) => {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      });
      return tags;
    }, []);
  }, [coursesData?.courses]);

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  // Handle blur effect for search input
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }, [])

  // Mock questions for the Community tab
  const mockQuestions = [
    {
      id: "q1",
      question: "What prerequisites do I need for the Advanced Data Engineering course?",
      user: {
        id: "user1",
        name: "Alex Johnson",
        image: "https://randomuser.me/api/portraits/men/22.jpg"
      },
      upvotes: 15,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      answered: true,
      answer: {
        text: "For the Advanced Data Engineering course, you should have a good understanding of Python basics, some experience with SQL, and familiarity with data structures. You don't need expertise in all areas, but the more comfortable you are with these topics, the easier you'll find the course.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
      }
    },
    {
      id: "q2",
      question: "Do you plan to release any courses on cloud data engineering with AWS or Azure?",
      user: {
        id: "user2",
        name: "Sarah Miller",
        image: "https://randomuser.me/api/portraits/women/42.jpg"
      },
      upvotes: 23,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
      answered: true,
      answer: {
        text: "Yes! I'm currently working on a comprehensive AWS Data Engineering course that will cover S3, Redshift, Glue, and Lambda for data processing. It should be released within the next month. I also have plans for an Azure course later this year.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() // 4 days ago
      }
    }
  ];

  // Get filtered courses based on current filters
  const getFilteredCourses = () => {
    let filteredCourses = Array.isArray(coursesData?.courses) 
      ? [...coursesData.courses] 
      : [];
    
    // Filter by course type if selected
    if (courseTypeFilter) {
      filteredCourses = filteredCourses.filter(course => 
        course.type === courseTypeFilter
      );
    }
    
    // Filter by tag if selected
    if (selectedTag) {
      filteredCourses = filteredCourses.filter(course => 
        course.tags && Array.isArray(course.tags) && course.tags.includes(selectedTag)
      );
    }
    
    // Filter by search query if present
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredCourses = filteredCourses.filter(course => 
        course.title.toLowerCase().includes(query) ||
        (course.description && course.description.toLowerCase().includes(query)) ||
        (course.tags && Array.isArray(course.tags) && course.tags.some((tag: string) => tag.toLowerCase().includes(query)))
      );
    }
    
    return filteredCourses;
  };

  if (isLoading || !creator) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded w-64"></div>
      <div className="h-40 bg-muted rounded"></div>
    </div>;
  }

  return (
    <Tabs defaultValue="overview" value={activeTab} onValueChange={handleTabChange} className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="text-base">Overview</TabsTrigger>
          <TabsTrigger value="courses" className="text-base">All Courses</TabsTrigger>
          <TabsTrigger value="community" className="text-base">Community</TabsTrigger>
          <TabsTrigger value="about" className="text-base">About</TabsTrigger>
        </TabsList>
        
        {activeTab === "courses" && (
          <div className="flex gap-2 w-full sm:w-auto">
            {showSearch ? (
              <div className="relative w-full sm:w-auto">
                <Input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9 h-10"
                  autoFocus
                  onBlur={() => {
                    if (!searchQuery) setShowSearch(false)
                  }}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowSearch(true)}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Share</span>
            </Button>
          </div>
        )}
      </div>
      
      {/* Overview Tab - Default landing view with featured content */}
      <TabsContent value="overview" className="space-y-12">
        {/* Featured courses section - only show if there are courses */}
        {coursesData?.featuredCourses && coursesData.featuredCourses.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold flex items-center">
                <Star className="h-5 w-5 mr-2 text-yellow-500 fill-yellow-500" />
                Featured Courses
              </h2>
              <Button variant="outline" size="sm" asChild>
                <a href="#courses-section" onClick={() => handleTabChange("courses")}>
                  View All <MoveRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coursesData.featuredCourses.map((course: ExtendedCourse) => (
                <CourseCard key={course.id} course={course} themeColor={themeColor} />
              ))}
            </div>
          </div>
        )}
        
        {/* Testimonial Carousel - only show if there are testimonials */}
        {creator.testimonials && creator.testimonials.length > 0 && (
          <div className="my-12">
            <h2 className="text-2xl font-semibold mb-6">What Students Say</h2>
            <Testimonials 
              testimonials={creator.testimonials} 
              themeColor={themeColor}
              layout="carousel" // Use carousel instead of grid
            />
          </div>
        )}
        
        {/* Call to action */}
        <div className="bg-muted/30 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to Start Learning?</h2>
          <p className="mb-6 text-muted-foreground max-w-2xl mx-auto">
            Join thousands of students already learning with {creator.name}. 
            Explore courses and find the perfect fit for your educational journey.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <a href="#courses-section" onClick={() => handleTabChange("courses")}>
                <BookOpen className="mr-2 h-5 w-5" />
                Browse Courses
              </a>
            </Button>
            <Button variant="outline" size="lg">
              <UserPlus className="mr-2 h-5 w-5" />
              Follow Instructor
            </Button>
          </div>
        </div>
      </TabsContent>
      
      {/* Simplified Courses Tab */}
      <TabsContent value="courses" className="space-y-8" id="courses-section">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-1">All Courses</h2>
          <p className="text-muted-foreground">Browse all courses by {creator.name}</p>
        </div>

        {/* Tags filter */}
        {uniqueTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge 
              variant={!selectedTag ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setSelectedTag(undefined)}
            >
              All
            </Badge>
            {uniqueTags.map((tag) => (
              <Badge 
                key={tag} 
                variant={selectedTag === tag ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => setSelectedTag(tag === selectedTag ? undefined : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Course grid - Updated to match explore page grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredCourses().length > 0 ? (
            getFilteredCourses().map((course) => (
              <CourseCard 
                key={course.id} 
                course={course} 
                themeColor={themeColor} 
                creator={creator} 
              />
            ))
          ) : isLoading ? (
            // Loading skeleton
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse bg-muted rounded-xl h-80"></div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Video className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">No courses found</h3>
              {searchQuery || selectedTag ? (
                <p className="text-muted-foreground max-w-md mb-4">
                  No courses match your current search or filter criteria.
                  Try adjusting your search or filters.
                </p>
              ) : (
                <p className="text-muted-foreground max-w-md mb-4">
                  {creator.name} hasn't published any courses yet.
                  Check back soon for new content.
                </p>
              )}
              {searchQuery || selectedTag ? (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTag(undefined);
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </TabsContent>
      
      {/* Simplified Community Tab */}
      <TabsContent value="community" className="space-y-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">Community Q&A</h2>
          <p className="text-muted-foreground">
            Have questions about courses or content? Browse through commonly asked questions or 
            submit your own to get answers directly from {creator.name}.
          </p>
        </div>
        <QuestionsList 
          questions={mockQuestions} 
          themeColor={themeColor}
          isAuthenticated={true}
        />
      </TabsContent>
      
      {/* About Tab - Most important part for our dynamic creator profile */}
      <TabsContent value="about" className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">About {creator.name}</h3>
            <div className="prose dark:prose-invert max-w-none">
              <p>{creator.bio}</p>
              
              {creator.education && (
                <>
                  <h4 className="text-lg font-medium mt-6 mb-2">Education</h4>
                  <div className="space-y-1">
                    {creator.education.split('\n').map((item: string, i: number) => (
                      <p key={i} className="text-muted-foreground">{item}</p>
                    ))}
                  </div>
                </>
              )}
              
              {creator.achievements && (
                <>
                  <h4 className="text-lg font-medium mt-6 mb-2">Achievements</h4>
                  <div className="space-y-1">
                    {creator.achievements.split('\n').map((item: string, i: number) => (
                      <p key={i} className="text-muted-foreground">{item}</p>
                    ))}
                  </div>
                </>
              )}

              {creator.institutionName && (
                <>
                  <h4 className="text-lg font-medium mt-6 mb-2">Institution</h4>
                  <div className="not-prose border rounded-md p-4 bg-muted/10">
                    <h5 className="font-medium text-base">{creator.institutionName}</h5>
                    {creator.institutionDescription && (
                      <p className="mt-2 text-muted-foreground text-sm">{creator.institutionDescription}</p>
                    )}
                    {creator.institutionWebsite && (
                      <a 
                        href={creator.institutionWebsite} 
                        target="_blank"
                        rel="noopener noreferrer" 
                        className="mt-2 inline-flex text-sm text-primary hover:underline"
                      >
                        Visit website
                        <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div>
            {(creator.expertise || creator.categories) && (
              <>
                <h3 className="text-xl font-semibold mb-4">Areas of Expertise</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {creator.expertise?.map((expertise: string, idx: number) => (
                    <Badge key={`exp-${idx}`} variant="secondary" className="text-sm">{expertise}</Badge>
                  ))}
                  {creator.categories?.map((category: string, idx: number) => (
                    <Badge key={`cat-${idx}`} variant="secondary" className="text-sm">{category}</Badge>
                  ))}
                  {(!creator.expertise || creator.expertise.length === 0) && 
                  (!creator.categories || creator.categories.length === 0) && (
                    <p className="text-muted-foreground">No areas of expertise specified</p>
                  )}
                </div>
              </>
            )}
            
            {creator.location && (
              <div className="mt-6">
                <h4 className="text-lg font-medium mb-2">Location</h4>
                <p className="text-muted-foreground flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {creator.location}
                </p>
              </div>
            )}
            
            {creator.languages && creator.languages.length > 0 && (
              <div className="mt-6">
                <h4 className="text-lg font-medium mb-2">Languages</h4>
                <p className="text-muted-foreground flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    <path d="M2 12h20"/>
                  </svg>
                  {creator.languages.join(', ')}
                </p>
              </div>
            )}
            
            {creator.milestones && creator.milestones.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Milestones</h3>
                <CreatorMilestones 
                  milestones={creator.milestones} 
                  themeColor={themeColor}
                  layout="timeline"
                />
              </div>
            )}
          </div>
        </div>
        
        {creator.customSections && creator.customSections.length > 0 && (
          <div className="mt-8 pt-8 border-t">
            <CustomSections 
              sections={creator.customSections} 
              themeColor={themeColor}
            />
          </div>
        )}
        
        {creator.showResources && creator.resources && creator.resources.length > 0 && (
          <div className="mt-12 pt-8 border-t">
            <h3 className="text-xl font-semibold mb-4">Educational Resources</h3>
            <CreatorResources 
              resources={creator.resources}
              description={creator.resourcesDescription}
              themeColor={themeColor}
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export default CreatorTabs