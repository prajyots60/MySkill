/**
 * Simple rate limiting utility for Next.js API routes
 * This helps prevent abuse of your API endpoints
 */

export interface RateLimitConfig {
  /**
   * The maximum number of requests allowed in the time window
   */
  limit: number;
  
  /**
   * The time window in seconds
   */
  windowMs: number;
  
  /**
   * Optional identifier for the rate limit (e.g., "uploads", "auth")
   */
  identifier?: string;
}

// In-memory storage for rate limiting
// In production, you'd use Redis or another persistent store
const ipRequests: Record<string, { count: number; resetAt: number }> = {};

/**
 * Check if a request exceeds the rate limit
 * 
 * @param ip Client IP address
 * @param config Rate limit configuration
 * @returns Whether the request should be rate limited
 */
export function rateLimit(ip: string, config: RateLimitConfig): { limited: boolean; remaining: number; resetAt: number } {
  const { limit, windowMs, identifier = 'default' } = config;
  const now = Date.now();
  const key = `${ip}:${identifier}`;
  
  // Clean up expired entries
  Object.keys(ipRequests).forEach(k => {
    if (ipRequests[k].resetAt < now) {
      delete ipRequests[k];
    }
  });
  
  // Initialize or get existing request record
  if (!ipRequests[key] || ipRequests[key].resetAt < now) {
    ipRequests[key] = {
      count: 0,
      resetAt: now + windowMs * 1000
    };
  }
  
  // Increment the counter
  ipRequests[key].count += 1;
  
  // Check if the limit is exceeded
  const limited = ipRequests[key].count > limit;
  const remaining = Math.max(0, limit - ipRequests[key].count);
  
  return {
    limited,
    remaining,
    resetAt: ipRequests[key].resetAt
  };
}

/**
 * Apply rate limiting to a Next.js API route
 * 
 * @param request Next.js request object
 * @param config Rate limit configuration 
 * @returns Rate limit information or null if disabled
 */
export function applyRateLimit(request: Request, config: RateLimitConfig) {
  // Get client IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded || realIp || '127.0.0.1').split(',')[0].trim();
  
  return rateLimit(ip, config);
}
