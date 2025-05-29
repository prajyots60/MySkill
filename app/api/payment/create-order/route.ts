import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { razorpay, formatAmountForRazorpay } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { courseId } = await req.json();

    // Get course details
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        price: true,
      },
    });

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    if (!course.price || course.price <= 0) {
      return new NextResponse("Invalid course price", { status: 400 });
    }

    // Create Razorpay order
    const amount = formatAmountForRazorpay(course.price);
    const currency = "INR";
    
    // Create a shorter receipt ID that stays within Razorpay's 40 character limit
    const timestamp = Date.now().toString().slice(-10); // Use last 10 digits of timestamp
    const shortenedCourseId = course.id.length > 15 ? course.id.slice(0, 15) : course.id;
    const receipt = `rcpt_${shortenedCourseId}_${timestamp}`;
    
    // Ensure receipt is no longer than 40 characters
    const finalReceipt = receipt.slice(0, 40);
    
    const options = {
      amount,
      currency,
      receipt: finalReceipt,
      notes: {
        courseId: course.id,
        userId: session.user.id,
      },
    };

    const order = await razorpay.orders.create(options);

    // Save order details to database
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: course.price,
        currency,
        status: "PENDING",
        course: { connect: { id: course.id } },
        user: { connect: { id: session.user.id } },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[RAZORPAY_ORDER_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
