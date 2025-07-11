import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = params;

    // Get the course to check permissions and get related data
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
        thumbnail: true,
        sections: {
          select: {
            id: true,
            lectures: {
              select: {
                id: true,
                videoId: true,
                documents: {
                  select: {
                    id: true,
                    url: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to delete this course" },
        { status: 403 }
      );
    }

    // Delete all related resources from Supabase storage
    const resourcesToDelete: string[] = [];

    // Delete thumbnail if exists
    if (course.thumbnail) {
      const thumbnailPath = course.thumbnail.split("/").pop();
      if (thumbnailPath) {
        resourcesToDelete.push(`${session.user.id}/${thumbnailPath}`);
      }
    }

    // Delete all lecture videos and documents
    course.sections.forEach((section) => {
      section.lectures.forEach((lecture) => {
        if (lecture.videoId) {
          const videoPath = lecture.videoId.split("/").pop();
          if (videoPath) {
            resourcesToDelete.push(`${session.user.id}/${videoPath}`);
          }
        }
        lecture.documents.forEach((doc) => {
          if (doc.url) {
            const docPath = doc.url.split("/").pop();
            if (docPath) {
              resourcesToDelete.push(`${session.user.id}/${docPath}`);
            }
          }
        });
      });
    });

    // Delete all resources from Supabase storage
    if (resourcesToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("content")
        .remove(resourcesToDelete);
      if (storageError) {
        console.error("Error deleting resources from storage:", storageError);
      }
    }

    // Delete the course and all related data from the database
    await prisma.content.delete({
      where: {
        id: courseId,
      },
    });

    // Invalidate all related caches
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id));
    await invalidateCache(REDIS_KEYS.COURSE(courseId));
    await redis.del(`course:${courseId}:sections`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete course",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to update this course" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log("Course update request data:", { courseId, ...body });

    // Check if we're updating visibility
    if (body.visibility) {
      console.log("Updating course visibility to:", body.visibility);

      // If changing to HIDDEN, ensure there's at least one invite link created later
      if (body.visibility === "HIDDEN") {
        console.log("Course is being set to HIDDEN mode");
      }

      // If changing from HIDDEN to PUBLIC, delete all invite links
      if (body.visibility === "PUBLIC") {
        const courseWithLinks = await prisma.content.findUnique({
          where: {
            id: courseId,
          },
          select: {
            visibility: true,
            inviteLinks: {
              select: { id: true },
            },
          },
        });

        if (
          courseWithLinks &&
          courseWithLinks.visibility === "HIDDEN" &&
          courseWithLinks.inviteLinks.length > 0
        ) {
          console.log("Deleting invite links as course is being made public");
          // Delete all invite links
          await prisma.inviteLink.deleteMany({
            where: {
              contentId: courseId,
            },
          });
        }
      }
    }

    // Update the course in the database with all provided fields
    // This way any field sent in the request will be updated
    const updatedCourse = await prisma.content.update({
      where: {
        id: courseId,
      },
      data: {
        ...body,
        // Ensure price is properly converted to a number if present
        ...(body.price !== undefined && { price: Number(body.price) }),
        // Explicitly set visibility if provided to ensure it's properly updated
        ...(body.visibility && { visibility: body.visibility }),
      },
    });

    console.log("Course updated successfully:", updatedCourse);

    // Log visibility state for debugging
    console.log("Updated course visibility:", updatedCourse.visibility);

    // Invalidate cache
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id));
    await invalidateCache(REDIS_KEYS.COURSE(courseId));

    // ONLY add specific cache invalidation for the CourseEditor page issue
    // without affecting other working cache logic elsewhere
    await redis.del(`course:${courseId}`);

    // Additional invalidation for any visibility-related caches
    await redis.del(`course:${courseId}:visibility`);

    // For new courses that might not have visibility set
    if (
      updatedCourse.visibility === null ||
      updatedCourse.visibility === undefined
    ) {
      // Set default visibility to PUBLIC if not specified
      const fixedCourse = await prisma.content.update({
        where: { id: courseId },
        data: { visibility: "PUBLIC" },
      });
      return NextResponse.json({ success: true, course: fixedCourse });
    }

    return NextResponse.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update course",
      },
      { status: 500 }
    );
  }
}
