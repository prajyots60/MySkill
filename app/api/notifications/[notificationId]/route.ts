import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { notificationId } = params

    // Delete the notification
    await prisma.notification.delete({
      where: {
        id: notificationId,
        userId: session.user.id, // Ensure the notification belongs to the user
      },
    })

    return NextResponse.json({
      success: true,
      message: "Notification deleted successfully",
    })
  } catch (error) {
    console.error("[NOTIFICATION_DELETE]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 