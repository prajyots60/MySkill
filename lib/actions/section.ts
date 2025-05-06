"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import {} from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { authOptions } from "../auth"

// Create a new section
export async function createSection({
  courseId,
  title,
  description,
  order,
}: {
  courseId: string
  title: string
  description?: string
  order?: number
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
      },
    })

    if (!course) {
      throw new Error("Course not found")
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to add sections to this course")
    }

    // If order is not provided, get the highest order and add 1
    let sectionOrder = order
    if (!sectionOrder) {
      const highestOrderSection = await prisma.section.findFirst({
        where: {
          contentId: courseId,
        },
        orderBy: {
          order: "desc",
        },
        select: {
          order: true,
        },
      })

      sectionOrder = highestOrderSection ? highestOrderSection.order + 1 : 0
    }

    // Create the section in the database
    const section = await prisma.section.create({
      data: {
        title,
        description,
        order: sectionOrder,
        content: {
          connect: { id: courseId },
        },
      },
    })

    // Invalidate cache
    await redis.del(`course:${courseId}`)

    revalidatePath(`/dashboard/creator/content/${courseId}`)
    return { success: true, sectionId: section.id }
  } catch (error) {
    console.error("Error creating section:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to create section" }
  }
}

// Update a section
export async function updateSection({
  sectionId,
  title,
  description,
  order,
}: {
  sectionId: string
  title?: string
  description?: string
  order?: number
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    })

    if (!section) {
      throw new Error("Section not found")
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to update this section")
    }

    // Update the section in the database
    const updatedSection = await prisma.section.update({
      where: {
        id: sectionId,
      },
      data: {
        title,
        description,
        order,
      },
    })

    // Invalidate cache
    await redis.del(`course:${section.content.id}`)

    revalidatePath(`/dashboard/creator/content/${section.content.id}`)
    return { success: true, section: updatedSection }
  } catch (error) {
    console.error("Error updating section:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update section" }
  }
}

// Delete a section
export async function deleteSection(sectionId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    })

    if (!section) {
      throw new Error("Section not found")
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to delete this section")
    }

    // Delete the section from the database
    await prisma.section.delete({
      where: {
        id: sectionId,
      },
    })

    // Invalidate cache
    await redis.del(`course:${section.content.id}`)

    revalidatePath(`/dashboard/creator/content/${section.content.id}`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting section:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete section" }
  }
}

// Reorder sections
export async function reorderSections({
  courseId,
  orderedSectionIds,
}: {
  courseId: string
  orderedSectionIds: string[]
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
      },
    })

    if (!course) {
      throw new Error("Course not found")
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to reorder sections in this course")
    }

    // Update the order of each section
    const updatePromises = orderedSectionIds.map((sectionId, index) => {
      return prisma.section.update({
        where: {
          id: sectionId,
        },
        data: {
          order: index,
        },
      })
    })

    await Promise.all(updatePromises)

    // Invalidate cache
    await redis.del(`course:${courseId}`)

    revalidatePath(`/dashboard/creator/content/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error("Error reordering sections:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to reorder sections" }
  }
}
