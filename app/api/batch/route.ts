import { type NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

type BatchRequestItem = {
  id: string
  path: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: any
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get batch requests
    const { requests } = (await req.json()) as { requests: BatchRequestItem[] }

    if (!Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ error: "Invalid batch request format" }, { status: 400 })
    }

    // Limit batch size for security
    if (requests.length > 20) {
      return NextResponse.json({ error: "Batch size exceeds maximum limit of 20 requests" }, { status: 400 })
    }

    // Process each request in parallel
    const responses = await Promise.all(
      requests.map(async (request) => {
        try {
          // Build the request URL
          const url = new URL(request.path, req.nextUrl.origin)

          // Create request options
          const options: RequestInit = {
            method: request.method,
            headers: {
              "Content-Type": "application/json",
              // Forward auth cookies
              Cookie: req.headers.get("cookie") || "",
            },
          }

          // Add body for non-GET requests
          if (request.method !== "GET" && request.body) {
            options.body = JSON.stringify(request.body)
          }

          // Execute the request
          const response = await fetch(url.toString(), options)

          // Parse response
          const data = await response.json().catch(() => ({}))

          return {
            id: request.id,
            status: response.status,
            data,
          }
        } catch (error) {
          console.error(`Error processing batch request ${request.id}:`, error)
          return {
            id: request.id,
            status: 500,
            data: { error: "Internal server error" },
          }
        }
      }),
    )

    // Convert array to object with request IDs as keys
    const responseObject = responses.reduce(
      (acc, response) => {
        acc[response.id] = {
          status: response.status,
          data: response.data,
        }
        return acc
      },
      {} as Record<string, any>,
    )

    return NextResponse.json(responseObject)
  } catch (error) {
    console.error("Error processing batch request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
