import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreatorProfile, updateCreatorProfile } from "@/app/creators/[creatorId]/actions/get-creator";

type UpdateCreatorProfileInput = {
  name?: string
  bio?: string
  mobileNumber?: string
  website?: string
  location?: string
  image?: string
  coverImages?: string[]
  coverImageIds?: string[]
  tagline?: string
  customTitle?: string
  themeColor?: string
  expertise?: string[]
  yearsTeaching?: number
  education?: string
  achievements?: string
  institutionName?: string
  institutionDescription?: string
  institutionWebsite?: string
  verified?: boolean
  badges?: string[]
  milestones?: string[]
  testimonials?: string[]
  customSections?: string[]
  resources?: {
    title: string
    description: string
    url: string
  }[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    const { creatorId } = await params;
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated for accessing own profile
    // Public profiles can be accessed by anyone though
    if (!session && creatorId !== "public") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch creator profile
    const result = await getCreatorProfile(creatorId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch creator profile" },
        { status: 404 }
      );
    }

    return NextResponse.json({ creator: result.creator });
  } catch (error) {
    console.error("Error in creator profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    const { creatorId } = await params;
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is the owner of the profile
    if (!session?.user?.id || session.user.id !== creatorId) {
      return NextResponse.json(
        { error: "Unauthorized to update this profile" },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const data = await request.json();
    
    // Update creator profile
    const result = await updateCreatorProfile(data);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update creator profile" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in creator profile update API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}