import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, BookOpen, Star, TrendingUp, Play } from "lucide-react";
import Link from "next/link";

interface OptimizedCourseCardProps {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  authorName?: string;
  authorImage?: string;
  authorId?: string; // Added authorId parameter
  enrollmentCount?: number;
  updatedAt: Date;
  lectureCount?: number;
  duration?: string;
  isPublished?: boolean;
  isTrending?: boolean;
  tags?: string[];
  price?: number;
  isEnrolled?: boolean;
  creator?: { id: string }; // Add this to handle the nested creator object
  rating?: number; // Add rating to the props
  reviewCount?: number; // Add reviewCount to the props
}

export function OptimizedCourseCard({
  id,
  title,
  description,
  thumbnailUrl,
  authorName,
  authorImage,
  authorId, // This might be coming in different formats
  enrollmentCount = 0,
  updatedAt,
  lectureCount = 0,
  duration = "",
  isPublished = true,
  isTrending = false,
  tags = [],
  price,
  isEnrolled = false,
  creator, // Add this to handle the nested creator object
  rating = 0, // Add rating to the props
  reviewCount = 0, // Add reviewCount to the props with default value
}: OptimizedCourseCardProps) {
  const formattedDate = new Date(updatedAt).toLocaleDateString();

  // Determine the actual creator ID to use (may come from authorId or creator.id)
  const creatorId = authorId || (creator && creator.id) || null;

  return (
    <Card className="premium-card-luxe overflow-hidden flex flex-col group">
      <div className="relative h-48 overflow-hidden">
        <img
          src={thumbnailUrl || "/placeholder.svg?height=192&width=384"}
          alt={title}
          className="object-cover w-full h-full transition-transform group-hover:scale-105 duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute top-3 right-3 flex gap-2">
          {price === 0 && (
            <Badge className="status-success border-none">Free</Badge>
          )}
          {isTrending && (
            <Badge className="status-warning border-none">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-gradient-luxe line-clamp-1 group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          <div className="flex items-center gap-1 text-amber-500">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-medium">
              {typeof rating === "number" ? rating.toFixed(1) : "0.0"}
            </span>
            <span className="text-xs text-muted-foreground">
              ({reviewCount || 0})
            </span>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          {creatorId ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/creators/${creatorId}`}
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={authorImage || "/placeholder.svg"}
                    alt={authorName || "Instructor"}
                  />
                  <AvatarFallback>
                    {authorName?.charAt(0) || "I"}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Link
                href={`/creators/${creatorId}`}
                className="hover:text-primary transition-colors"
              >
                <span>{authorName || "Instructor"}</span>
              </Link>
            </div>
          ) : (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={authorImage || "/placeholder.svg"}
                  alt={authorName || "Instructor"}
                />
                <AvatarFallback>{authorName?.charAt(0) || "I"}</AvatarFallback>
              </Avatar>
              <span>{authorName || "Instructor"}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {description || "No description available"}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{enrollmentCount} students</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>{lectureCount} lectures</span>
          </div>
          {duration && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{duration}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex justify-between items-center border-t">
        <div className="flex items-center gap-2">
          {price === undefined || price === null ? (
            <div className="text-sm font-medium text-muted-foreground">
              Contact for price
            </div>
          ) : price === 0 ? (
            <div className="text-sm font-medium text-green-600">Free</div>
          ) : (
            <div className="text-sm font-medium">{price} ₹</div>
          )}
          {price !== undefined && price !== null && price > 0 && (
            <Badge variant="outline" className="text-xs">
              Paid
            </Badge>
          )}
        </div>

        <Button asChild size="sm" className="btn-luxe-primary gap-2">
          <Link href={`/content/${id}`}>
            <Play className="h-4 w-4" />
            View Course
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
