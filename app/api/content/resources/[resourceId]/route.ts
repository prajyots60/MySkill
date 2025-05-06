import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Delete resource by ID
export async function DELETE(
  request: Request,
  { params }: { params: { resourceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    
    const resourceId = params.resourceId
    
    if (!resourceId) {
      return NextResponse.json({ message: "Resource ID is required" }, { status: 400 })
    }
    
    // Find the resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            creatorId: true
          }
        }
      }
    })
    
    if (!resource) {
      return NextResponse.json({ message: "Resource not found" }, { status: 404 })
    }
    
    // Check permissions - only creator or admin can delete
    const isCreator = resource.course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ message: "Not authorized to delete this resource" }, { status: 403 })
    }
    
    // Delete resource
    await prisma.resource.delete({
      where: { id: resourceId }
    })
    
    return NextResponse.json({ 
      success: true,
      message: "Resource deleted successfully" 
    })
  } catch (error) {
    console.error("Error deleting resource:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete resource" },
      { status: 500 }
    )
  }
}