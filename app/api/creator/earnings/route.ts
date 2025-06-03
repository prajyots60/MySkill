import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PaymentStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only creators and admins can access earnings data
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("timeRange") || "30days"
    const transactionType = searchParams.get("transactionType") || "all"

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case "7days":
        startDate.setDate(now.getDate() - 7)
        break
      case "30days":
        startDate.setDate(now.getDate() - 30)
        break
      case "90days":
        startDate.setDate(now.getDate() - 90)
        break
      case "year":
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case "all":
        startDate = new Date(0) // Beginning of time
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    // Get creator's courses
    const creatorCourses = await prisma.content.findMany({
      where: {
        creatorId: session.user.id,
        type: "COURSE"
      },
      select: {
        id: true,
        title: true,
        price: true
      }
    })

    const courseIds = creatorCourses.map(course => course.id)

    // Get all payments for creator's courses
    const payments = await prisma.payment.findMany({
      where: {
        courseId: { in: courseIds },
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      include: {
        course: {
          select: {
            title: true,
            price: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    // Filter by transaction type
    let filteredPayments = payments
    if (transactionType !== "all") {
      switch (transactionType) {
        case "sale":
          filteredPayments = payments.filter(p => p.status === PaymentStatus.SUCCESS)
          break
        case "refund":
          filteredPayments = payments.filter(p => p.status === PaymentStatus.REFUNDED)
          break
        case "pending":
          filteredPayments = payments.filter(p => p.status === PaymentStatus.PENDING)
          break
      }
    }

    // Calculate metrics
    const successfulPayments = payments.filter(p => p.status === PaymentStatus.SUCCESS)
    const refundedPayments = payments.filter(p => p.status === PaymentStatus.REFUNDED)
    const pendingPayments = payments.filter(p => p.status === PaymentStatus.PENDING)

    const totalEarnings = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const totalRefunds = refundedPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const netEarnings = totalEarnings - totalRefunds
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)

    // Calculate previous period for growth comparison
    const prevStartDate = new Date(startDate)
    const periodDiff = now.getTime() - startDate.getTime()
    prevStartDate.setTime(startDate.getTime() - periodDiff)

    const prevPeriodPayments = await prisma.payment.findMany({
      where: {
        courseId: { in: courseIds },
        status: PaymentStatus.SUCCESS,
        createdAt: {
          gte: prevStartDate,
          lt: startDate
        }
      }
    })

    const prevPeriodEarnings = prevPeriodPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const earningsGrowth = prevPeriodEarnings > 0 
      ? Math.round(((totalEarnings - prevPeriodEarnings) / prevPeriodEarnings) * 100)
      : totalEarnings > 0 ? 100 : 0

    // Get earnings over time (monthly data for charts)
    const monthlyEarnings = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        SUM(amount) as total
      FROM "Payment"
      WHERE "courseId" = ANY(${courseIds})
        AND status = 'SUCCESS'
        AND "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    ` as Array<{ month: Date; total: number }>

    // Get earnings by course
    const courseEarnings = await prisma.$queryRaw`
      SELECT 
        c.title as name,
        SUM(p.amount) as value
      FROM "Payment" p
      JOIN "Content" c ON p."courseId" = c.id
      WHERE p."courseId" = ANY(${courseIds})
        AND p.status = 'SUCCESS'
        AND p."createdAt" >= ${startDate}
      GROUP BY c.id, c.title
      ORDER BY value DESC
      LIMIT 10
    ` as Array<{ name: string; value: number }>

    // Format transactions for frontend
    const transactions = filteredPayments.map(payment => ({
      id: payment.id,
      date: payment.createdAt.toISOString(),
      amount: payment.amount,
      type: payment.status === PaymentStatus.SUCCESS ? "sale" 
           : payment.status === PaymentStatus.REFUNDED ? "refund"
           : payment.status === PaymentStatus.PENDING ? "pending"
           : "failed",
      course: payment.course.title,
      student: payment.user.name || payment.user.email || "Unknown",
      status: payment.status.toLowerCase()
    }))

    // Get last successful payout info (mock for now - you can implement actual payout tracking)
    const lastPayout = {
      amount: 1500.0, // You can implement actual payout tracking
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    }

    // Calculate platform fee (assuming 10% platform fee)
    const platformFeeRate = 0.10
    const platformFees = totalEarnings * platformFeeRate
    const creatorEarnings = totalEarnings - platformFees

    const response = {
      totalEarnings: creatorEarnings,
      pendingPayouts: pendingAmount,
      lastPayout: lastPayout.amount,
      lastPayoutDate: lastPayout.date,
      earningsGrowth,
      
      // Time series data for charts
      earningsOverTime: monthlyEarnings.map(item => ({
        date: item.month.toLocaleDateString('en-US', { month: 'short' }),
        value: Number(item.total)
      })),
      
      courseEarnings: courseEarnings.map(item => ({
        name: item.name,
        value: Number(item.value)
      })),
      
      transactions,
      
      // Additional metrics
      metrics: {
        totalSales: successfulPayments.length,
        totalRefunds: refundedPayments.length,
        pendingTransactions: pendingPayments.length,
        conversionRate: courseIds.length > 0 ? 
          (successfulPayments.length / Math.max(courseIds.length, 1) * 100).toFixed(2) : "0.00"
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("[EARNINGS_API_ERROR]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
