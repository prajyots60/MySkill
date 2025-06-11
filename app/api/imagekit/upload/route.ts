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
      select: { coverImages: true }
    });

    // Update cover images array
    const coverImages = profile?.coverImages || ["", "", ""];
    const imageIndex = parseInt(index);
    if (imageIndex >= 0 && imageIndex < 3) {
      // If there's an existing image at this index, delete it from ImageKit
      if (coverImages[imageIndex]) {
        const existingUrl = coverImages[imageIndex];
        const fileId = existingUrl.split('/').pop()?.split('.')[0];
        if (fileId) {
          try {
            await imagekit.deleteFile(fileId);
          } catch (error) {
            console.error("Error deleting old image:", error);
          }
        }
      }
      coverImages[imageIndex] = result.url;
    }

    // Update profile
    await prisma.creatorProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        coverImages,
      },
      update: {
        coverImages,
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
    const imageUrl = searchParams.get("url");
    const index = searchParams.get("index");

    if (!imageUrl || !index) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Extract fileId from the URL
    const fileId = imageUrl.split('/').pop()?.split('.')[0];
    if (!fileId) {
      return NextResponse.json(
        { error: "Invalid image URL" },
        { status: 400 }
      );
    }

    // Delete from ImageKit
    await imagekit.deleteFile(fileId);

    // Update profile in database
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: session.user.id },
      select: { coverImages: true }
    });

    if (profile) {
      const coverImages = [...profile.coverImages];
      const imageIndex = parseInt(index);
      if (imageIndex >= 0 && imageIndex < 3) {
        coverImages[imageIndex] = "";
      }

      await prisma.creatorProfile.update({
        where: { userId: session.user.id },
        data: { coverImages }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting from ImageKit:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}