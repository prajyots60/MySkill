import { NextResponse } from "next/server"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { EnrollmentStatus, PaymentStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redis } from "@/lib/redis"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
    } = await req.json()

    // Verify payment signature
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex")

    if (signature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Get course details for price
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { price: true },
    })

    // Update payment status and create enrollment
    let payment;
    try {
      payment = await prisma.payment.update({
        where: { orderId: razorpay_order_id },
        data: {
          status: PaymentStatus.SUCCESS,
        },
      });
    } catch (updateError) {
      console.error("Failed to find payment record:", updateError);
      // If payment record doesn't exist, create it
      payment = await prisma.payment.create({
        data: {
          orderId: razorpay_order_id,
          amount: course?.price || 0,
          currency: "INR",
          status: PaymentStatus.SUCCESS,
          course: { connect: { id: courseId } },
          user: { connect: { id: session.user.id } },
        },
      });
    }

    // Check for existing enrollment first
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    });

    if (!existingEnrollment) {
      // Create enrollment record if it doesn't exist
      await prisma.enrollment.create({
        data: {
          userId: session.user.id,
          contentId: courseId,
          status: EnrollmentStatus.ACTIVE,
          price: course?.price || 0,
          paymentId: payment.id,
        },
      });
    } else {
      // Update existing enrollment to ACTIVE if it's not already
      await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: EnrollmentStatus.ACTIVE,
          paymentId: payment.id,
        },
      });
    }

    // Revalidate relevant paths to ensure fresh data
    revalidatePath(`/content/${courseId}`);
    revalidatePath(`/content/${courseId}/player`);
    revalidatePath(`/api/courses/${courseId}/enrollment`);
    revalidatePath(`/api/courses/${courseId}/enrollment-status`);
    
    // Clear Redis cache for enrollment status
    const enrollmentCacheKey = `enrollment:${courseId}:${session.user.id}`;
    await redis.del(enrollmentCacheKey);
    
    // Also clear any lecture-specific enrollment cache entries
    const cacheKeys = await redis.keys(`enrollment:${courseId}:${session.user.id}:*`);
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and enrollment created/updated",
      enrollmentStatus: true
    })
  } catch (error) {
    console.error("Payment verification error:", error)
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    )
  }
}
