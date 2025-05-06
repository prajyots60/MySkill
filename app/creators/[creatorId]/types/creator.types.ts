// Types for creator profile page
import { User } from "@/lib/types"

// Define ContentTypeExtended to include all possible course types
export type ContentTypeExtended = string | 'LIVE' | 'RECORDED' | 'UPCOMING';

// Extend the Course interface with additional properties
export interface ExtendedCourse {
  id: string;
  title: string;
  creatorName?: string;
  description?: string;
  type?: ContentTypeExtended;
  reviewCount?: number;
  rating?: number;
  enrolled?: number;
  enrollmentCount?: number;
  lectureCount?: number;
  level?: string;
  thumbnail?: string;
  duration?: number;
  lessons?: number;
  category?: string;
  tags?: string[];
  creatorId?: string;
  price?: number;
  isPublished?: boolean;
  isTrending?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define interfaces for community questions
export interface QuestionAnswer {
  text: string;
  createdAt: string;
}

export interface QuestionUser {
  name: string;
  image: string;
  id: string;
}

export interface QuestionItem {
  id: string;
  user: QuestionUser;
  question: string;
  createdAt: string;
  upvotes: number;
  answered: boolean;
  answer?: QuestionAnswer;
}

// Define the interface for testimonials
export interface Testimonial {
  name: string;
  title: string;
  content: string;
  rating: number;
  image: string;
}

// Define the interface for milestones
export interface Milestone {
  title: string;
  icon: string;
}

// Define the interface for badges
export interface Badge {
  title: string;
  icon: string;
  color: string;
}

// Define the interface for live sessions
export interface LiveSession {
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: number;
  thumbnail?: string;
  category?: string;
  registered?: number;
}

// Define the interface for resources
export interface Resource {
  title: string;
  description: string;
  url: string;
  buttonText: string;
}

// Define the interface for custom sections
export interface CustomSection {
  title: string;
  content: string;
}

// Define the interface for mock creator data
export interface MockCreator extends Partial<User> {
  name?: string;
  bio?: string;
  image?: string;
  expertise?: string[];
  social?: {
    twitter?: string;
    youtube?: string;
    linkedin?: string;
    website?: string;
    instagram?: string;
  };
  institutionName?: string;
  institutionDescription?: string;
  institutionWebsite?: string;
  coverImage?: string;
  customTitle?: string | null;
  tagline?: string;
  themeColor?: string;
  education?: string;
  achievements?: string;
  yearsTeaching?: string;
  totalLectures?: number;
  averageRating?: number;
  location?: string;
  languages?: string[];
  categories?: string[];
  verified?: boolean;
  milestones?: Milestone[];
  badges?: Badge[];
  _count?: {
    contents?: number;
    followers?: number;
    courses?: number;
    liveSessions?: number;
  };
  isOwnProfile?: boolean;
  socialLinks?: Record<string, string>;
  testimonials?: Testimonial[];
  liveSessions?: LiveSession[];
  questions?: QuestionItem[];
  showResources?: boolean;
  resources?: Resource[];
  resourcesDescription?: string;
  resourceCta?: string;
  resourceCtaLink?: string;
  coursesTitle?: string;
  coursesIntro?: string;
  customSections?: CustomSection[];
  createdAt: Date;
}

// Custom mock courses data structure
export interface MockCoursesData {
  courses: ExtendedCourse[];
  featuredCourses?: ExtendedCourse[];
  coursesByCategory?: Record<string, ExtendedCourse[]>;
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}