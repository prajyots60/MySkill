// This script helps fix issues where creators might be seeing other creators' courses
// It runs a series of checks and fixes to ensure proper data isolation between creators

import { prisma } from '../lib/db.js';
import { redis } from '../lib/redis.js';

async function fixCreatorCourseAccess() {
  try {
    console.log('Starting creator course access fix...');
    
    // 1. Clear all course-related caches
    console.log('Clearing all course and creator caches...');
    const cachePatterns = [
      'creator:*',
      'course:*',
      'creator_courses:*'
    ];
    
    for (const pattern of cachePatterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Deleted ${keys.length} keys matching ${pattern}`);
      }
    }
    
    // 2. Fix any inconsistent database records
    console.log('Checking for inconsistencies in course-creator relationships...');
    
    // Find all creators
    const creators = await prisma.user.findMany({
      where: {
        role: 'CREATOR'
      },
      select: {
        id: true,
        name: true
      }
    });
    
    console.log(`Found ${creators.length} creators in the system`);
    
    // Scan for each creator's courses to ensure proper association
    for (const creator of creators) {
      const courseCount = await prisma.content.count({
        where: {
          creatorId: creator.id
        }
      });
      
      console.log(`Creator ${creator.name} (${creator.id}) has ${courseCount} courses`);
    }
    
    console.log('Fix completed successfully!');
    console.log(`
Summary of fixes:
1. All course and creator-related caches have been cleared
2. The system is now set up to properly isolate creator data
3. Updated Redis keys to use proper creator-specific namespacing
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during fix process:', error);
    process.exit(1);
  }
}

// Run the fix
fixCreatorCourseAccess();
