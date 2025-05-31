// Utility script to clear all course-related caches
// This can be run to fix any caching issues with creator courses

import { redis } from '../lib/redis.js';

async function clearAllCourseCaches() {
  try {
    console.log('Starting cache clearing process...');
    
    // Clear all course and creator related caches
    const patterns = [
      'creator:*',
      'course:*',
      'creator_courses:*'
    ];
    
    let totalCleared = 0;
    
    for (const pattern of patterns) {
      console.log(`Finding keys matching pattern: ${pattern}`);
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`Deleting ${keys.length} keys...`);
        await redis.del(...keys);
        totalCleared += keys.length;
      } else {
        console.log('No keys found for this pattern');
      }
    }
    
    console.log(`Successfully cleared ${totalCleared} cache keys`);
    console.log('Cache clearing complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing caches:', error);
    process.exit(1);
  }
}

// Run the function
clearAllCourseCaches();
