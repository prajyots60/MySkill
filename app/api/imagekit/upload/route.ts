import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function POST(req: NextRequest) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const index = formData.get("index") as string;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Upload to ImageKit
    const result = await imagekit.upload({
      file: base64,
      fileName: file.name,
      folder: "/creator-cover-images",
      useUniqueFileName: true,
    });

    // Get current profile
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: session.user.id },
      select: { coverImages: true, coverImageIds: true }
    });

    // Update cover images array
    const coverImages = profile?.coverImages || ["", "", ""];
    const coverImageIds = profile?.coverImageIds || ["", "", ""];
    const imageIndex = parseInt(index);
    
    if (imageIndex >= 0 && imageIndex < 3) {
      // If there's an existing image at this index, delete it from ImageKit
      if (coverImageIds[imageIndex]) {
        try {
          await imagekit.deleteFile(coverImageIds[imageIndex]);
        } catch (error) {
          console.error("Error deleting old image:", error);
        }
      }
      
      coverImages[imageIndex] = result.url;
      coverImageIds[imageIndex] = result.fileId;
    }

    // Update profile
    await prisma.creatorProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        coverImages,
        coverImageIds,
      },
      update: {
        coverImages,
        coverImageIds,
      },
    });

    return NextResponse.json({
      url: result.url,
      fileId: result.fileId,
    });
  } catch (error) {
    console.error("Error uploading to ImageKit:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const index = searchParams.get("index");

    if (!index) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get current profile
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: session.user.id },
      select: { coverImages: true, coverImageIds: true }
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const imageIndex = parseInt(index);
    if (imageIndex < 0 || imageIndex >= 3) {
      return NextResponse.json(
        { error: "Invalid image index" },
        { status: 400 }
      );
    }

    // Delete from ImageKit if there's a file ID
    if (profile.coverImageIds[imageIndex]) {
      try {
        await imagekit.deleteFile(profile.coverImageIds[imageIndex]);
      } catch (error) {
        console.error("Error deleting from ImageKit:", error);
      }
    }

    // Update arrays
    const coverImages = [...profile.coverImages];
    const coverImageIds = [...profile.coverImageIds];
    coverImages[imageIndex] = "";
    coverImageIds[imageIndex] = "";

    // Update profile
    await prisma.creatorProfile.update({
      where: { userId: session.user.id },
      data: {
        coverImages,
        coverImageIds,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting from ImageKit:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}