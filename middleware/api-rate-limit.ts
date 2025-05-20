import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize rate limiter
// This requires setting up Upstash Redis
// Replace with your Upstash Redis URL and token
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Create a rate limiter that allows 30 requests per minute
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
  prefix: 'api-wasabi-upload',
});

export async function middleware(request: NextRequest) {
  // Check authentication - this is in addition to the session check in the API route
  const token = await getToken({ req: request });
  
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  
  // Implement rate limiting based on user ID or IP address if user ID not available
  const identifier = token.sub || request.ip || 'anonymous';
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    return NextResponse.json(
      { 
        message: 'Rate limit exceeded',
        limit,
        remaining,
        reset,
      }, 
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }
  
  return NextResponse.next();
}

// Only apply this middleware to the Wasabi upload API routes
export const config = {
  matcher: [
    '/api/wasabi-presigned-upload-url',
    '/api/storage/upload',
    '/api/storage/get-upload-url',
    '/api/wasabi-chunked-upload',
  ],
};
