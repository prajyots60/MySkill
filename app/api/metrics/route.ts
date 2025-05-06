import { type NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { redis } from "@/lib/redis"

// Metrics collection endpoint
export async function POST(req: NextRequest) {
  try {
    // Get user info if available (anonymous metrics are also accepted)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const userId = token?.id || "anonymous"

    // Parse metrics data
    const metrics = await req.json()

    // Add timestamp and user info
    const metricsWithMeta = {
      ...metrics,
      timestamp: Date.now(),
      userId,
      userAgent: req.headers.get("user-agent") || "unknown",
      path: req.headers.get("referer") || "unknown",
    }

    // Store in Redis with 7-day expiration
    // Using a list structure to maintain chronological order
    const key = `metrics:${userId}:${Date.now()}`
    await redis.set(key, JSON.stringify(metricsWithMeta), { ex: 60 * 60 * 24 * 7 })

    // Also add to a sorted set for easier querying
    if (metrics.lcp) {
      await redis.zadd("metrics:lcp", { score: metrics.lcp, member: key })
    }

    if (metrics.cls) {
      await redis.zadd("metrics:cls", { score: metrics.cls, member: key })
    }

    // Return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error storing metrics:", error)
    return NextResponse.json({ error: "Failed to store metrics" }, { status: 500 })
  }
}

// Metrics retrieval endpoint (admin only)
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const metric = searchParams.get("metric") || "lcp"
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    // Get metrics from Redis
    let results

    if (metric === "lcp" || metric === "cls" || metric === "fid") {
      // Get from sorted set
      const keys = await redis.zrange(`metrics:${metric}`, 0, limit - 1)

      // Get actual metric data
      if (keys.length > 0) {
        const values = await redis.mget(...keys)
        results = values.map((v) => JSON.parse(v || "{}"))
      } else {
        results = []
      }
    } else {
      // Get recent metrics
      const keys = await redis.keys("metrics:*:*")
      const recentKeys = keys.slice(-limit)

      if (recentKeys.length > 0) {
        const values = await redis.mget(...recentKeys)
        results = values.map((v) => JSON.parse(v || "{}"))
      } else {
        results = []
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error retrieving metrics:", error)
    return NextResponse.json({ error: "Failed to retrieve metrics" }, { status: 500 })
  }
}
