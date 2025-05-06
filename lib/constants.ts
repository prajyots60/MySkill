export const CACHE_DURATION = 60 * 60 // 1 hour in seconds

export const REDIS_KEYS = {
  CREATOR_COURSES: (creatorId: string) => `creator:${creatorId}:courses`,
  PUBLIC_COURSES: (search: string, limit: number, offset: number, level: string | null, tags: string) =>
    `public:courses:${search}:${limit}:${offset}:${level}:${tags}`,
  FEATURED_COURSES: 'public:featured_courses',
}
