import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { courseId } = body

    // Get course details from database
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        price: true,
      },
    })

    if (!course || !course.price) {
      return NextResponse.json(
        { error: "Course not found or invalid price" },
        { status: 404 }
      )
    }

    // Create Razorpay order
    // Create a shorter receipt ID that stays within Razorpay's 40 character limit
    // Use a shorter prefix and truncate courseId if necessary
    const timestamp = Date.now().toString().slice(-10); // Use last 10 digits of timestamp
    const shortenedCourseId = courseId.length > 15 ? courseId.slice(0, 15) : courseId;
    const receipt = `rcpt_${shortenedCourseId}_${timestamp}`;
    
    // Ensure receipt is no longer than 40 characters
    const finalReceipt = receipt.slice(0, 40);
    
    const options = {
      amount: course.price * 100, // Amount in smallest currency unit (paise for INR)
      currency: "INR",
      receipt: finalReceipt,
      notes: {
        courseId: course.id,
        userId: session.user.id,
        courseTitle: course.title,
      },
    }

    const order = await razorpay.orders.create(options)

    // Save order details to database
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: course.price,
        currency: options.currency,
        status: "PENDING",
        course: { connect: { id: course.id } },
        user: { connect: { id: session.user.id } },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error("Payment initialization error:", error)
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    )
  }
}
