"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VideoPlayer from "@/components/video-player";
import WasabiLecturePlayer from "@/components/wasabi-lecture-player";
import { LectureComments } from "@/components/lecture-comments";
import { LiveChat } from "@/components/live-chat";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedQuery } from "@/hooks/use-optimized-query";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Lock,
  Clock,
  MessageSquare,
  Menu,
  ThumbsUp,
  Share2,
  Bookmark,
  AlertCircle,
  LayoutDashboard,
  Loader2,
  Radio,
  ChevronDown,
  BookOpen,
  PenLine,
  Search,
  X,
  Plus,
  Save,
  Forward,
  MoreVertical,
  ExternalLink,
  Copy,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  MessageSquareShare,
} from "lucide-react";
import Link from "next/link";
import type { Course, Lecture, Section } from "@/lib/types";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { EnrollmentModal } from "@/components/enrollment-modal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CourseResources } from "@/components/course-resources";

interface VideoPlayerPageProps {
  contentId: string;
  lectureId: string;
}

// Note interface for taking notes during lectures
interface Note {
  id: string;
  content: string;
  createdAt: Date;
}

export default function VideoPlayerPage({
  contentId,
  lectureId,
}: VideoPlayerPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  // Core state
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Get invite token from URL if present
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Extract inviteToken from URL on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("inviteToken");
      setInviteToken(token);
    }
  }, []);

  // Progress tracking state
  const [completedLectures, setCompletedLectures] = useState<
    Record<string, boolean>
  >({});
  const [currentProgress, setCurrentProgress] = useState(0);

  // Access control state
  const [hasAccess, setHasAccess] = useState(false);
  const isCreator = session?.user?.id === course?.creatorId;
  const isAdmin = session?.user?.role === "ADMIN";
  const isFreeCourse = course?.price === 0 || course?.price === null;
  const isPreviewLecture = currentLecture?.isPreview;
  const isLiveLecture = currentLecture?.type === "LIVE";

  // UI state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("discussion");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState("");

  // Refs
  const videoRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  // Toggle sidebar visibility - memoized to prevent unnecessary re-renders
  const toggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
  }, []);

  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Find adjacent lectures first since we need this for the video handlers
  const findAdjacentLectures = useCallback(() => {
    let prevLecture: Lecture | null = null;
    let nextLecture: Lecture | null = null;

    let foundCurrent = false;

    for (const section of sections) {
      for (let i = 0; i < section.lectures.length; i++) {
        const lecture = section.lectures[i];

        if (foundCurrent) {
          nextLecture = lecture;
          break;
        }

        if (lecture.id === lectureId) {
          foundCurrent = true;
          if (i > 0) {
            prevLecture = section.lectures[i - 1];
          } else {
            // Check previous section's last lecture
            const sectionIndex = sections.findIndex((s) => s.id === section.id);
            if (sectionIndex > 0) {
              const prevSection = sections[sectionIndex - 1];
              prevLecture =
                prevSection.lectures[prevSection.lectures.length - 1];
            }
          }
        } else if (!foundCurrent) {
          prevLecture = lecture;
        }
      }

      if (nextLecture) break;
    }

    return { prevLecture, nextLecture };
  }, [sections, lectureId]);

  const { prevLecture, nextLecture } = useMemo(
    () => findAdjacentLectures(),
    [findAdjacentLectures]
  );

  // Define navigation function
  const navigateToLecture = useCallback(
    (lectureId: string) => {
      // Only include invite token if present AND user is not enrolled
      // This ensures enrolled users don't need the token for subsequent navigation
      const inviteTokenParam =
        inviteToken && !isEnrolled ? `?inviteToken=${inviteToken}` : "";
      router.push(
        `/content/${contentId}/player/${lectureId}${inviteTokenParam}`
      );
      setShowMobileNav(false);
    },
    [router, contentId, setShowMobileNav, inviteToken, isEnrolled]
  );

  // Define video handling functions with useCallback
  const handleVideoProgress = useCallback(
    (progress: number) => {
      // Save progress every 10 seconds (this would be throttled in production)
      if (currentLecture) {
        // In a real implementation, you would call an API here to save progress
        console.log("Saving progress:", progress);
      }
    },
    [currentLecture]
  );

  const handleVideoComplete = useCallback(async () => {
    if (currentLecture && course) {
      try {
        // Mark as completed in the database
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lectureId: currentLecture.id,
            isComplete: true,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update progress");
        }

        // Update local state
        setCompletedLectures((prev) => ({
          ...prev,
          [currentLecture.id]: true,
        }));

        // Recalculate progress
        const progressResponse = await fetch(
          `/api/progress?courseId=${contentId}`
        );
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          setCurrentProgress(progressData.progress?.percentage || 0);
        }

        toast({
          title: "Lecture Completed",
          description: "Your progress has been saved",
        });

        // If there's a next lecture, show a prompt to continue
        if (nextLecture) {
          toast({
            title: "Continue Learning",
            description: (
              <div className="flex items-center justify-between">
                <span>Ready for the next lecture?</span>
                <Button
                  size="sm"
                  onClick={() => navigateToLecture(nextLecture.id)}
                  className="ml-2"
                >
                  Continue
                </Button>
              </div>
            ),
            duration: 5000,
          });
        }
      } catch (error) {
        console.error("Error updating completion status:", error);
        toast({
          title: "Error",
          description: "Failed to update your progress. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [
    currentLecture,
    course,
    contentId,
    nextLecture,
    toast,
    setCompletedLectures,
    setCurrentProgress,
    navigateToLecture,
  ]);

  // Then memoize the video player component
  const videoPlayerComponent = useMemo(() => {
    if (!currentLecture) return null;

    if (currentLecture.videoSource === "WASABI") {
      // Check if we have the required encryption data and log it
      const secureMetadata = (currentLecture as any).secureMetadata || {};
      const hasEncryptionData =
        secureMetadata.isEncrypted && secureMetadata.encryptionKey;

      console.log("WASABI video encryption details:", {
        isEncrypted: !!secureMetadata.isEncrypted,
        hasKey: !!secureMetadata.encryptionKey,
        hasIV: !!secureMetadata.encryptionIV,
        ivLength: secureMetadata.encryptionIV?.length,
        ivFirstChars: secureMetadata.encryptionIV
          ? secureMetadata.encryptionIV.substring(0, 8) + "..."
          : "NULL",
      });

      return (
        <WasabiLecturePlayer
          videoId={currentLecture.videoId || ""}
          title={currentLecture.title}
          isEncrypted={!!secureMetadata.isEncrypted}
          encryptionKey={secureMetadata.encryptionKey}
          encryptionIV={secureMetadata.encryptionIV}
          className="w-full h-full"
          autoplay={false}
          onProgress={handleVideoProgress}
          onComplete={handleVideoComplete}
        />
      );
    } else {
      return (
        <VideoPlayer
          courseId={contentId}
          lectureId={currentLecture.id}
          title={currentLecture.title}
          videoId={currentLecture.videoId || ""}
          videoSource={currentLecture.videoSource as "YOUTUBE" | "ODYSEE"}
          claimId={currentLecture.claimId || undefined}
          claimName={currentLecture.claimName || undefined}
          streamData={currentLecture.streamData}
          onComplete={handleVideoComplete}
          onProgress={handleVideoProgress}
          isCompleted={completedLectures[currentLecture.id] || false}
        />
      );
    }
  }, [
    currentLecture,
    contentId,
    handleVideoProgress,
    handleVideoComplete,
    completedLectures,
  ]);

  // Use the optimized query hook for the enrollment check with improved caching and memoized keys
  const enrollmentQueryKey = `enrollment-${contentId}-${
    session?.user?.id || "guest"
  }`;

  const { data: enrollmentData, isLoading: enrollmentLoading } =
    useOptimizedQuery(
      enrollmentQueryKey,
      async () => {
        const response = await fetch(
          `/api/courses/${contentId}/enrollment-status?lectureId=${lectureId}`,
          {
            // Add cache headers to prevent browser caching issues
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );
        if (!response.ok) {
          if (response.status === 401) {
            // Don't call router.push directly during render or effect
            setPendingRedirect(
              `/auth/signin?callbackUrl=/content/${contentId}/player/${lectureId}`
            );
            throw new Error("Not authenticated");
          }

          if (response.status === 403) {
            // User is not enrolled in a paid course
            setShowEnrollmentModal(true);

            // Start countdown for redirect
            redirectTimerRef.current = setInterval(() => {
              setRedirectCountdown((prev) => {
                if (prev <= 1) {
                  if (redirectTimerRef.current) {
                    clearInterval(redirectTimerRef.current);
                  }
                  setPendingRedirect(`/content/${contentId}`);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);

            throw new Error("Not enrolled");
          }

          throw new Error(
            `Failed to check enrollment status: ${response.statusText}`
          );
        }

        const data = await response.json();
        return data;
      },
      {
        ttl: 30 * 60 * 1000, // Cache for 30 minutes (increased from 5 minutes)
        refetchInterval: false, // Disable automatic refetching
        refetchOnWindowFocus: false, // Disable refetch on window focus
        backgroundRefresh: false, // Disable background refresh to prevent unnecessary requests
        onError: (err) => {
          console.error("Enrollment check error:", err);
          setError(err instanceof Error ? err.message : "An error occurred");
          toast({
            title: "Error",
            description: "Failed to check enrollment status",
            variant: "destructive",
          });
          setLoading(false);
        },
      }
    );

  // Use optimized query for course data with improved caching
  const { data: fetchedCourseData, isLoading: courseLoading } =
    useOptimizedQuery(
      () =>
        enrollmentData
          ? `course-${contentId}-${session?.user?.id || "guest"}`
          : null, // Always fetch course data when enrollment data is available
      async () => {
        const response = await fetch(`/api/courses/${contentId}`, {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to load course: ${response.statusText}`);
        }
        return response.json();
      },
      {
        ttl: 30 * 60 * 1000, // Cache for 30 minutes
        refetchOnWindowFocus: false, // Disable refetch on window focus
        onSuccess: (data) => {
          if (data && data.course) {
            setCourse(data.course);
            setSections(data.course.sections || []);

            // Set all sections open by default
            const sectionsOpenState: Record<string, boolean> = {};
            data.course.sections.forEach((section: Section) => {
              sectionsOpenState[section.id] = true;
            });
            setOpenSections(sectionsOpenState);
          }
        },
        onError: (err) => {
          console.error("Error loading course:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load course"
          );
          toast({
            title: "Error",
            description: "Failed to load course content",
            variant: "destructive",
          });
        },
      }
    );

  // Use optimized query for lecture data with improved caching
  const { data: lectureData, isLoading: lectureLoading } = useOptimizedQuery(
    () =>
      enrollmentData
        ? `lecture-${lectureId}-${session?.user?.id || "guest"}`
        : null, // Always fetch lecture data when enrollment data is available
    async () => {
      const response = await fetch(`/api/lectures/${lectureId}`, {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) {
        if (response.status === 403) {
          setError(
            "You don't have access to this lecture. Please enroll in the course first."
          );
          throw new Error("Access denied to lecture");
        }
        throw new Error(`Failed to load lecture: ${response.statusText}`);
      }
      return response.json();
    },
    {
      ttl: 30 * 60 * 1000, // Cache for 30 minutes
      refetchOnWindowFocus: false, // Disable refetch on window focus
      onSuccess: (data) => {
        if (data && data.lecture) {
          console.log("Lecture data received:", {
            id: data.lecture.id,
            title: data.lecture.title,
            isEncrypted: !!data.lecture.secureMetadata?.isEncrypted,
            hasEncryptionKey: !!data.lecture.secureMetadata?.encryptionKey,
            hasEncryptionIV: !!data.lecture.secureMetadata?.encryptionIV,
            secureMetadataKeys: data.lecture.secureMetadata
              ? Object.keys(data.lecture.secureMetadata)
              : [],
          });
          setCurrentLecture(data.lecture);
        }
      },
      onError: (err) => {
        console.error("Error loading lecture:", err);
        setError(err instanceof Error ? err.message : "Failed to load lecture");
        toast({
          title: "Error",
          description: "Failed to load lecture content",
          variant: "destructive",
        });
      },
    }
  );

  // Use optimized query for progress data with improved caching
  const { data: progressData } = useOptimizedQuery(
    () =>
      enrollmentData &&
      (enrollmentData.isEnrolled ||
        enrollmentData.isPreviewLecture ||
        enrollmentData.hasValidInvite ||
        enrollmentData.isFree)
        ? `progress-${contentId}-${session?.user?.id || "guest"}`
        : null, // Only fetch progress if user actually has access
    async () => {
      const response = await fetch(`/api/progress?courseId=${contentId}`, {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load progress: ${response.statusText}`);
      }
      return response.json();
    },
    {
      ttl: 10 * 60 * 1000, // Cache for 10 minutes
      refetchOnWindowFocus: false, // Disable refetch on window focus
      onSuccess: (data) => {
        if (data && data.progress) {
          if (data.progress.completedLectureIds) {
            const completedMap: Record<string, boolean> = {};
            data.progress.completedLectureIds.forEach((id: string) => {
              completedMap[id] = true;
            });
            setCompletedLectures(completedMap);
            setCurrentProgress(data.progress.percentage || 0);
          }

          // Set last watched position if available
          if (data.progress.lastWatchedPosition) {
          }
        }
      },
    }
  );

  // Use the optimized query for lecture resources with improved caching - Added after enrollmentData is defined
  const { data: lectureResourcesData, isLoading: resourcesLoading } =
    useOptimizedQuery(
      () =>
        hasAccess
          ? `lecture-resources-${lectureId}-${session?.user?.id || "guest"}`
          : null, // Only fetch if user has access
      async () => {
        const response = await fetch(
          `/api/content/resources?lectureId=${lectureId}`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );
        if (!response.ok) {
          // Don't throw error for 403 responses, just return empty resources
          if (response.status === 403) {
            return { resources: [] };
          }
          throw new Error(
            `Failed to load lecture resources: ${response.statusText}`
          );
        }
        return response.json();
      },
      {
        ttl: 30 * 60 * 1000, // Cache for 30 minutes
        refetchOnWindowFocus: false, // Disable refetch on window focus
        onError: (err) => {
          console.error("Error loading lecture resources:", err);
          toast({
            title: "Error",
            description: "Failed to load lecture resources",
            variant: "destructive",
          });
        },
      }
    );

  // Fetch the lecture's like count and user's like status
  useEffect(() => {
    if (lectureId && session?.user && hasAccess) {
      const fetchLikeData = async () => {
        try {
          const response = await fetch(`/api/lectures/${lectureId}/likes`);
          if (response.ok) {
            const data = await response.json();
            setLikeCount(data.count);
            setIsLiked(data.isLiked);
          }
        } catch (error) {
          console.error("Error fetching lecture likes:", error);
        }
      };

      fetchLikeData();
    }
  }, [lectureId, session?.user, hasAccess]);

  // Fetch the user's bookmark status for this lecture
  useEffect(() => {
    if (lectureId && session?.user && hasAccess) {
      const fetchBookmarkStatus = async () => {
        try {
          const response = await fetch(`/api/lectures/${lectureId}/bookmark`);
          if (response.ok) {
            const data = await response.json();
            setIsBookmarked(data.isBookmarked);
          }
        } catch (error) {
          console.error("Error fetching bookmark status:", error);
        }
      };

      fetchBookmarkStatus();
    }
  }, [lectureId, session?.user, hasAccess]);

  // Effect to update access states when relevant data changes
  useEffect(() => {
    if (enrollmentData) {
      const newEnrolledState =
        enrollmentData.isEnrolled ||
        enrollmentData.isPreviewLecture ||
        enrollmentData.hasValidInvite ||
        enrollmentData.isFree;
      setIsEnrolled(newEnrolledState);

      // If user is enrolled, clear the invite token to avoid unnecessary propagation
      if (newEnrolledState && inviteToken) {
        setInviteToken(null);
      }
    }

    // Update hasAccess whenever relevant states change
    const userHasAccess =
      isEnrolled ||
      isCreator ||
      isAdmin ||
      isFreeCourse ||
      isPreviewLecture ||
      (enrollmentData &&
        (enrollmentData.isPreviewLecture ||
          enrollmentData.hasValidInvite ||
          enrollmentData.isFree));
    setHasAccess(userHasAccess);
  }, [
    enrollmentData,
    isEnrolled,
    isCreator,
    isAdmin,
    isFreeCourse,
    isPreviewLecture,
    inviteToken,
  ]);

  // Add event listeners to prevent right-click and F12 developer tools
  useEffect(() => {
    // Only apply content protection for students (not creators or admins)
    // We need to check these values safely to avoid conditional hook issues
    const isCreatorValue = !!(
      session?.user?.id &&
      course?.creatorId &&
      session.user.id === course.creatorId
    );
    const isAdminValue = session?.user?.role === "ADMIN";
    const hasAccessValue =
      isEnrolled ||
      isCreatorValue ||
      isAdminValue ||
      course?.price === 0 ||
      course?.price === null ||
      currentLecture?.isPreview;

    if (hasAccessValue && !isCreatorValue && !isAdminValue) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (developer tools)
        if (
          e.key === "F12" ||
          (e.ctrlKey &&
            e.shiftKey &&
            (e.key === "I" || e.key === "J" || e.key === "C"))
        ) {
          e.preventDefault();
          toast({
            title: "Action blocked",
            description:
              "Developer tools access has been disabled on this page",
            variant: "destructive",
          });
          return false;
        }
      };

      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("keydown", handleKeyDown);

      // Cleanup function
      return () => {
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
    // Return empty cleanup function to maintain consistent hook behavior
    return () => {};
  }, [toast, session, course, currentLecture, isEnrolled]);

  // Update loading state based on query loading states
  useEffect(() => {
    setLoading(
      enrollmentLoading || (enrollmentData && (courseLoading || lectureLoading))
    );
  }, [
    enrollmentLoading,
    courseLoading,
    lectureLoading,
    enrollmentData?.isEnrolled,
  ]);

  // Use useEffect to handle redirects separately - this fixes the "Cannot update during render" error
  useEffect(() => {
    if (pendingRedirect) {
      // Use a small timeout to ensure this happens after render
      const redirectTimer = setTimeout(() => {
        router.push(pendingRedirect);
      }, 0);

      return () => clearTimeout(redirectTimer);
    }
  }, [pendingRedirect, router]);

  // Cleanup effect for the redirect timer
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
      }
    };
  }, []);

  // Add dummy notes for now
  useEffect(() => {
    if (!loading && isEnrolled) {
      setNotes([
        {
          id: "1",
          content:
            "This lecture covers important concepts about the main topics. The instructor explains the core principles and provides several examples to illustrate each point. Remember these key points for the upcoming quiz and make sure to review the attached resources for additional context.",
          createdAt: new Date(Date.now() - 3600000),
        },
      ]);
    }
  }, [loading, isEnrolled]);

  const toggleBookmark = async () => {
    if (!session?.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to bookmark this lecture",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/lectures/${lectureId}/bookmark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle bookmark");
      }

      const data = await response.json();
      setIsBookmarked(data.isBookmarked);

      toast({
        title: data.isBookmarked
          ? "Added to bookmarks"
          : "Removed from bookmarks",
        description: data.isBookmarked
          ? "Lecture added to your bookmarks"
          : "Lecture removed from your bookmarks",
      });
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast({
        title: "Error",
        description: "Failed to update bookmark status",
        variant: "destructive",
      });
    }
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const saveNote = () => {
    if (!currentNote.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      content: currentNote,
      createdAt: new Date(),
    };

    setNotes((prev) => [newNote, ...prev]);
    setCurrentNote("");

    toast({
      title: "Note Saved",
      description: "Your note has been saved successfully",
    });
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    toast({
      title: "Note Deleted",
      description: "Your note has been deleted",
    });
  };

  // Find current section
  const currentSection = sections.find((section) =>
    section.lectures.some((lecture) => lecture.id === lectureId)
  );

  // Calculate course progress
  const totalLectures = sections.reduce(
    (acc, section) => acc + section.lectures.length,
    0
  );
  const completedLectureCount = Object.keys(completedLectures).length;
  const courseProgressPercentage =
    totalLectures > 0 ? (completedLectureCount / totalLectures) * 100 : 0;

  // Filter lectures by search query
  const filteredSections =
    isSearching && searchText
      ? sections
          .map((section) => {
            const filteredLectures = section.lectures.filter((lecture) =>
              lecture.title.toLowerCase().includes(searchText.toLowerCase())
            );
            return { ...section, lectures: filteredLectures };
          })
          .filter((section) => section.lectures.length > 0)
      : sections;

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Skeleton className="h-[60vh] w-full mb-6" />
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-4 w-full mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div>
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p className="mb-6">Please sign in to access this content.</p>
        <Button asChild>
          <Link
            href={`/auth/signin?callbackUrl=/content/${contentId}/player/${lectureId}`}
          >
            Sign In
          </Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Error Loading Content</h1>
        <p className="mb-6">{error}</p>
        <Button asChild>
          <Link href="/explore">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  if (!course || !currentLecture) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Content Not Found</h1>
        <p className="mb-6">
          The content you are looking for does not exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/explore">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  // Define isLiveLecture variable to fix the ReferenceError
  // isLiveLecture is now defined at the top with other access control states

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess && course && !loading) {
    return (
      <>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center max-w-md p-6 rounded-lg border bg-card shadow-sm">
            <h2 className="text-2xl font-bold mb-2">Enrollment Required</h2>
            <p className="text-muted-foreground mb-4">
              {(course.price || 0) > 0
                ? "You need to purchase and enroll in this course to access its content."
                : "You need to enroll in this course to access its content."}
            </p>
            <div className="bg-muted p-4 rounded-md mb-4">
              <p className="font-medium">{course.title}</p>
              <p className="text-primary font-bold">
                {(course.price || 0) > 0
                  ? `$${(course.price || 0).toFixed(2)}`
                  : "Free"}
              </p>
            </div>
            <p className="text-sm text-destructive mb-4">
              Redirecting to course page in {redirectCountdown} seconds...
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setShowEnrollmentModal(true)}>
                {(course.price || 0) > 0 ? "Purchase Now" : "Enroll Now"}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/content/${contentId}`)}
              >
                View Course Details
              </Button>
            </div>
          </div>
        </div>
        <EnrollmentModal
          isOpen={showEnrollmentModal}
          onClose={() => setShowEnrollmentModal(false)}
          courseId={contentId}
          courseTitle={course.title}
          price={course.price || 0}
        />
      </>
    );
  }

  const toggleLectureCompletion = async (lectureId: string) => {
    try {
      // Toggle the completion status
      const newCompletionStatus = !completedLectures[lectureId];

      // Update local state immediately for responsive UI
      setCompletedLectures((prev) => ({
        ...prev,
        [lectureId]: newCompletionStatus,
      }));

      // Update in the database
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lectureId: lectureId,
          isComplete: newCompletionStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update progress");
      }

      // Recalculate overall progress
      const progressResponse = await fetch(
        `/api/progress?courseId=${contentId}`
      );
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setCurrentProgress(progressData.progress?.percentage || 0);
      }

      toast({
        title: newCompletionStatus
          ? "Lecture Completed"
          : "Lecture Marked as Incomplete",
        description: newCompletionStatus
          ? "Your progress has been saved"
          : "Lecture has been marked as incomplete",
      });
    } catch (error) {
      console.error("Error updating completion status:", error);
      toast({
        title: "Error",
        description: "Failed to update your progress. Please try again.",
        variant: "destructive",
      });

      // Revert local state if the API call failed
      setCompletedLectures((prev) => ({
        ...prev,
        [lectureId]: !completedLectures[lectureId],
      }));
    }
  };

  const toggleLike = async () => {
    if (!session?.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to mark this lecture as helpful",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/lectures/${lectureId}/likes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await response.json();
      setIsLiked(data.isLiked);
      setLikeCount(data.count);

      toast({
        title: data.isLiked ? "Marked as helpful" : "Removed helpful mark",
        description: data.isLiked
          ? "Thank you for your feedback"
          : "Your feedback has been updated",
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update helpful status",
        variant: "destructive",
      });
    }
  };

  // Handle sharing functionality with multiple platforms
  const handleShare = (platform: string) => {
    if (!currentLecture) return;

    // Get the current URL for sharing
    const currentUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `${
            process.env.NEXT_PUBLIC_APP_URL || ""
          }/content/${contentId}/player/${lectureId}`;

    const lectureTitle = encodeURIComponent(currentLecture.title);
    const lectureDesc = encodeURIComponent(
      currentLecture.description || "Check out this lecture!"
    );

    switch (platform) {
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            currentUrl
          )}`,
          "_blank"
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(
            currentUrl
          )}&text=${lectureTitle}`,
          "_blank"
        );
        break;
      case "linkedin":
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
            currentUrl
          )}`,
          "_blank"
        );
        break;
      case "whatsapp":
        window.open(
          `https://api.whatsapp.com/send?text=${lectureTitle}%20-%20${encodeURIComponent(
            currentUrl
          )}`,
          "_blank"
        );
        break;
      case "gmail":
        window.open(
          `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=&su=${lectureTitle}&body=${lectureDesc}%0A%0A${encodeURIComponent(
            currentUrl
          )}&tf=1`,
          "_blank"
        );
        break;
      case "email":
        window.open(
          `mailto:?subject=${lectureTitle}&body=${lectureDesc}%0A%0A${encodeURIComponent(
            currentUrl
          )}`,
          "_blank"
        );
        break;
      case "copy":
        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(currentUrl)
            .then(() => {
              toast({
                title: "Link Copied!",
                description: "Lecture link has been copied to your clipboard",
                variant: "default",
              });
            })
            .catch((err) => {
              console.error("Failed to copy: ", err);
              toast({
                title: "Copy Failed",
                description: "Could not copy the link. Please try again.",
                variant: "destructive",
              });
            });
        } else {
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement("textarea");
          textArea.value = currentUrl;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            toast({
              title: "Link Copied!",
              description: "Lecture link has been copied to your clipboard",
              variant: "default",
            });
          } catch (err) {
            console.error("Fallback: Failed to copy: ", err);
            toast({
              title: "Copy Failed",
              description: "Could not copy the link. Please try again.",
              variant: "destructive",
            });
          }
          document.body.removeChild(textArea);
        }
        break;
      default:
        break;
    }
  };

  // For backward compatibility
  const shareVideoUrl = () => {
    handleShare("copy");
  };

  return (
    <div className="bg-background min-h-screen">
      <style jsx global>{`
        /* Ensure video player takes full width and controls position correctly */
        .video-wrapper {
          width: 100% !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Video player styling with proper spacing */
        .video-js,
        .plyr {
          width: 100% !important;
          height: 100% !important;
        }

        /* Control positioning in fullscreen mode */
        :fullscreen .plyr__controls {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 99999 !important;
        }
      `}</style>
      <div className="flex flex-col lg:flex-row relative">
        {/* Main Content */}
        <div
          className={`transition-all duration-300 ${
            sidebarVisible ? "lg:w-3/4 xl:w-4/5" : "lg:w-full xl:w-full"
          }`}
        >
          {/* Back button (Mobile only) */}
          <div className="lg:hidden p-4 border-b">
            <Link
              href={`/content/${contentId}`}
              className="flex items-center text-sm font-medium hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to course
            </Link>
          </div>

          {/* Fixed Video Player with proper positioning - Completely redesigned container */}
          <div className="w-full bg-purple-200 flex items-center justify-center p-0.5">
            {hasAccess ? (
              <div
                className="w-full border border-gray-200 rounded-sm overflow-hidden"
                style={{ position: "relative" }}
              >
                <div className="video-wrapper w-full h-full">
                  {videoPlayerComponent}
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-black border border-gray-100 rounded-sm overflow-hidden">
                <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2 text-white">
                  Content Locked
                </h2>
                <p className="text-muted-foreground mb-4">
                  You need to enroll in this course to access this lecture.
                </p>
                <Button asChild className="mb-4">
                  <Link href={`/content/${contentId}`}>Enroll Now</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Lecture Info and Navigation */}
          <div className="p-4 md:p-6 border-b relative">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>{course.title}</span>
                  <span>•</span>
                  <span>{currentSection?.title}</span>
                </div>
                <h1 className="text-2xl font-bold">{currentLecture.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {currentLecture.isPreview && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-none"
                    >
                      Preview
                    </Badge>
                  )}
                  {isLiveLecture && (
                    <Badge
                      variant="secondary"
                      className="bg-red-500/10 text-red-500 border-none"
                    >
                      <Radio className="h-3 w-3 mr-1 text-red-500 animate-pulse" />
                      Live
                    </Badge>
                  )}
                  {completedLectures[currentLecture.id] && (
                    <Badge
                      variant="outline"
                      className="bg-green-500/10 text-green-500 border-green-500/20"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>

                {currentLecture.description && (
                  <div className="mt-4">
                    <p className="text-muted-foreground">
                      {currentLecture.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Dashboard button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 whitespace-nowrap"
                        onClick={() => router.push("/dashboard/student")}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="hidden sm:inline">Dashboard</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Return to your dashboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Section toggle button - positioned to the right of Dashboard button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSidebar}
                        className="gap-1 whitespace-nowrap"
                      >
                        {sidebarVisible ? (
                          <>
                            <PanelRightClose className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              Hide Sections
                            </span>
                          </>
                        ) : (
                          <>
                            <PanelRightOpen className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              Show Sections
                            </span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {sidebarVisible
                          ? "Hide section list"
                          : "Show section list"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex mt-4 gap-2 md:justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!prevLecture}
                      onClick={() =>
                        prevLecture && navigateToLecture(prevLecture.id)
                      }
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Go to previous lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={!nextLecture}
                      onClick={() =>
                        nextLecture && navigateToLecture(nextLecture.id)
                      }
                      className="gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Go to next lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 border-t pt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={toggleLike}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 ${
                          isLiked
                            ? "text-green-500 fill-green-500"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="flex items-center">
                        {isLiked ? "Liked" : "Like"}
                        {likeCount > 0 && (
                          <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                            {likeCount}
                          </span>
                        )}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isLiked ? "Remove like" : "Mark this like"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={toggleBookmark}
                    >
                      <Bookmark
                        className={`h-4 w-4 transition-colors ${
                          isBookmarked
                            ? "text-primary fill-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      {isBookmarked ? "Bookmarked" : "Bookmark"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isBookmarked
                        ? "Remove from bookmarks"
                        : "Save to bookmarks"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Share2 className="h-4 w-4" />
                          Share
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem
                          onClick={() => handleShare("facebook")}
                          className="cursor-pointer"
                        >
                          <Facebook className="h-4 w-4 mr-2 text-blue-600" />
                          Facebook
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("twitter")}
                          className="cursor-pointer"
                        >
                          <Twitter className="h-4 w-4 mr-2 text-blue-400" />
                          Twitter
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("linkedin")}
                          className="cursor-pointer"
                        >
                          <Linkedin className="h-4 w-4 mr-2 text-blue-700" />
                          LinkedIn
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("whatsapp")}
                          className="cursor-pointer"
                        >
                          <MessageSquareShare className="h-4 w-4 mr-2 text-green-500" />
                          WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("gmail")}
                          className="cursor-pointer"
                        >
                          <Mail className="h-4 w-4 mr-2 text-red-500" />
                          Gmail
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("email")}
                          className="cursor-pointer"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleShare("copy")}
                          className="cursor-pointer"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share this lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Report
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Report an issue with this lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Tabs Content */}
          <div className="p-4 md:p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              <TabsList className="bg-muted/50 p-1 inline-flex h-10 items-center justify-center rounded-md w-full sm:w-auto">
                {isLiveLecture && (
                  <TabsTrigger
                    value="live-chat"
                    className="flex-1 sm:flex-initial rounded-sm data-[state=active]:bg-background"
                  >
                    <Radio className="h-4 w-4 mr-2 text-red-500" />
                    Live Chat
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="discussion"
                  className="flex-1 sm:flex-initial rounded-sm data-[state=active]:bg-background"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Discussion
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="flex-1 sm:flex-initial rounded-sm data-[state=active]:bg-background"
                >
                  <PenLine className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger
                  value="resources"
                  className="flex-1 sm:flex-initial rounded-sm data-[state=active]:bg-background"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Resources
                </TabsTrigger>
              </TabsList>

              {isLiveLecture && (
                <TabsContent value="live-chat" className="h-[600px]">
                  <LiveChat
                    lectureId={lectureId}
                    isCreator={isCreator}
                    isAdmin={isAdmin}
                  />
                </TabsContent>
              )}

              <TabsContent value="discussion">
                <LectureComments lectureId={lectureId} />
              </TabsContent>

              <TabsContent value="notes" ref={notesRef}>
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Lecture Notes</CardTitle>
                    <CardDescription>
                      Take notes for this lecture to help you remember key
                      points.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Textarea
                        placeholder="Add your notes for this lecture..."
                        value={currentNote}
                        onChange={(e) => setCurrentNote(e.target.value)}
                        className="min-h-[150px]"
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={saveNote}
                          disabled={!currentNote.trim()}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Note
                        </Button>
                      </div>
                    </div>

                    {notes.length > 0 ? (
                      <div className="space-y-4 mt-6">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-4 bg-muted/30 rounded-lg relative group"
                          >
                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500"
                                      onClick={() => deleteNote(note.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete this note</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            <p className="text-sm">{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-4">
                              {new Date(note.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <PenLine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          You haven't added any notes yet
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="resources">
                <CourseResources
                  courseId={contentId}
                  lectureId={lectureId}
                  isCreator={isCreator}
                  title="Lecture Resources"
                  description={
                    isCreator
                      ? "Manage downloadable resources for this lecture"
                      : "Download materials provided by the instructor"
                  }
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sidebar - Course Content (Desktop) - MOVED TO THE RIGHT SIDE */}
        <div
          className={`hidden lg:block h-screen sticky top-0 border-l overflow-hidden bg-card transition-all duration-300 ${
            sidebarVisible
              ? "lg:w-1/4 xl:w-1/5 opacity-100"
              : "lg:w-0 xl:w-0 opacity-0 invisible"
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b flex flex-col">
              <div className="flex items-center justify-between">
                <Link
                  href={`/content/${contentId}`}
                  className="flex items-center text-sm font-medium hover:text-primary transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to course
                </Link>
              </div>

              <div className="mt-2 relative">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search lectures..."
                    className="pl-8 pr-8"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setIsSearching(!!e.target.value);
                    }}
                  />
                  {searchText && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full rounded-l-none"
                      onClick={() => {
                        setSearchText("");
                        setIsSearching(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center">
                <Progress
                  value={courseProgressPercentage}
                  className="h-2 flex-1"
                />
                <span className="text-xs ml-2">
                  {Math.round(courseProgressPercentage)}%
                </span>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto">
              <div className="max-h-full overflow-y-auto">
                {filteredSections.map((section) => (
                  <Collapsible
                    key={section.id}
                    open={openSections[section.id]}
                    onOpenChange={() => toggleSectionCollapse(section.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="p-4 bg-muted/30 hover:bg-muted/50 flex justify-between items-center w-full">
                        <div>
                          <h3 className="font-medium text-left">
                            {section.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 text-left">
                            {section.lectures.length} lectures •{" "}
                            {
                              section.lectures.filter(
                                (l) => completedLectures[l.id]
                              ).length
                            }{" "}
                            completed
                          </p>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {section.lectures.map((lecture) => (
                        <div key={lecture.id}>
                          <div
                            className={`p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                              lecture.id === currentLecture.id
                                ? "bg-primary/10"
                                : ""
                            }`}
                          >
                            {/* Clickable checkbox for lecture completion */}
                            <div
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLectureCompletion(lecture.id);
                              }}
                            >
                              {completedLectures[lecture.id] ? (
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground shrink-0 hover:border-green-500" />
                              )}
                            </div>

                            {/* Title and info - clickable for navigation */}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => navigateToLecture(lecture.id)}
                            >
                              <p className="text-sm font-medium truncate">
                                {lecture.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {lecture.isPreview && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4"
                                  >
                                    Preview
                                  </Badge>
                                )}
                                {lecture.type === "LIVE" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/20"
                                  >
                                    <Radio className="h-2 w-2 mr-1 text-red-500 animate-pulse" />
                                    Live
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {!hasAccess && !lecture.isPreview && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <Separator />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {isSearching && filteredSections.length === 0 && (
                  <div className="p-8 text-center">
                    <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      No lectures match your search
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile navigation toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
            <SheetTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="rounded-full shadow-lg"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Course Content</h3>
                  </div>
                  <div className="mt-2 relative">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search lectures..."
                        className="pl-8 pr-8"
                        value={searchText}
                        onChange={(e) => {
                          setSearchText(e.target.value);
                          setIsSearching(!!e.target.value);
                        }}
                      />
                      {searchText && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full rounded-l-none"
                          onClick={() => {
                            setSearchText("");
                            setIsSearching(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={courseProgressPercentage}
                    className="mt-2 h-2"
                  />
                </div>
                <div className="flex-grow overflow-y-auto">
                  <div className="max-h-full overflow-y-auto">
                    {filteredSections.map((section) => (
                      <Collapsible
                        key={section.id}
                        open={openSections[section.id]}
                        onOpenChange={() => toggleSectionCollapse(section.id)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="p-4 bg-muted/30 hover:bg-muted/50 flex justify-between items-center w-full">
                            <div>
                              <h3 className="font-medium text-left">
                                {section.title}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 text-left">
                                {section.lectures.length} lectures •{" "}
                                {
                                  section.lectures.filter(
                                    (l) => completedLectures[l.id]
                                  ).length
                                }{" "}
                                completed
                              </p>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {section.lectures.map((lecture) => (
                            <div key={lecture.id}>
                              <div
                                className={`p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                                  lecture.id === currentLecture.id
                                    ? "bg-primary/10"
                                    : ""
                                }`}
                              >
                                {/* Clickable checkbox for lecture completion */}
                                <div
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLectureCompletion(lecture.id);
                                  }}
                                >
                                  {completedLectures[lecture.id] ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border border-muted-foreground shrink-0 hover:border-green-500" />
                                  )}
                                </div>

                                {/* Title and info - clickable for navigation */}
                                <div
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => navigateToLecture(lecture.id)}
                                >
                                  <p className="text-sm font-medium truncate">
                                    {lecture.title}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {lecture.duration && (
                                      <span className="flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {Math.floor(lecture.duration / 60)}:
                                        {(lecture.duration % 60)
                                          .toString()
                                          .padStart(2, "0")}
                                      </span>
                                    )}
                                    {lecture.isPreview && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] h-4"
                                      >
                                        Preview
                                      </Badge>
                                    )}
                                    {lecture.type === "LIVE" && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/20"
                                      >
                                        <Radio className="h-2 w-2 mr-1 text-red-500 animate-pulse" />
                                        Live
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {!hasAccess && !lecture.isPreview && (
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <Separator />
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}

                    {isSearching && filteredSections.length === 0 && (
                      <div className="p-8 text-center">
                        <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          No lectures match your search
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
