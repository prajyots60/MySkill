'use server';

import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Records a DevTools violation for a user on a specific content.
 * After three warnings, the user is banned from accessing the content.
 */
export async function recordDevToolsViolation(contentId: string) {
  try {
    const session = await getAuthSession();
    
    if (!session?.user?.id) {
      return { error: 'User not authenticated' };
    }
    
    const userId = session.user.id;
    
    // Find existing violation record or create a new one
    const existingViolation = await prisma.devToolsViolation.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      }
    });
    
    if (existingViolation) {
      // If user is already banned, just return the current state
      if (existingViolation.isBanned) {
        return { 
          status: 'banned',
          warningCount: existingViolation.warningCount,
          message: 'You have been banned from accessing this content due to policy violations.'
        };
      }
      
      // Update warning count
      const newWarningCount = existingViolation.warningCount + 1;
      
      // Check if this violation should result in a ban (4th violation)
      const shouldBan = newWarningCount >= 4;
      
      // Update the record
      const updatedViolation = await prisma.devToolsViolation.update({
        where: {
          id: existingViolation.id
        },
        data: {
          warningCount: newWarningCount,
          isBanned: shouldBan,
          bannedAt: shouldBan ? new Date() : null,
        }
      });
      
      revalidatePath(`/content/${contentId}`);
      
      if (shouldBan) {
        return { 
          status: 'banned',
          warningCount: newWarningCount,
          message: 'You have been banned from accessing this content due to repeated policy violations.'
        };
      } else {
        return { 
          status: 'warning',
          warningCount: newWarningCount,
          message: `Warning ${newWarningCount}/3: Developer tools use detected. Continued use will result in loss of access to this content.`
        };
      }
    } else {
      // Create a new violation record with warning count 1
      await prisma.devToolsViolation.create({
        data: {
          userId,
          contentId,
          warningCount: 1,
          isBanned: false
        }
      });
      
      revalidatePath(`/content/${contentId}`);
      
      return { 
        status: 'warning',
        warningCount: 1,
        message: 'Warning 1/3: Developer tools use detected. Continued use will result in loss of access to this content.'
      };
    }
  } catch (error) {
    console.error('Error recording DevTools violation:', error);
    return { error: 'Failed to record violation' };
  }
}

/**
 * Checks if a user is banned from accessing specific content.
 */
export async function checkContentAccess(contentId: string) {
  try {
    const session = await getAuthSession();
    
    if (!session?.user?.id) {
      return { error: 'User not authenticated' };
    }
    
    // For creators and admins, always allow access
    if (session.user.role === 'CREATOR' || session.user.role === 'ADMIN') {
      return { canAccess: true };
    }
    
    const userId = session.user.id;
    
    const violation = await prisma.devToolsViolation.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      }
    });
    
    if (violation && violation.isBanned) {
      return { 
        canAccess: false, 
        status: 'banned',
        message: 'Your access to this content has been revoked due to policy violations.'
      };
    }
    
    return { 
      canAccess: true,
      status: violation ? 'warned' : 'normal',
      warningCount: violation?.warningCount || 0
    };
  } catch (error) {
    console.error('Error checking content access:', error);
    return { canAccess: false, error: 'Failed to verify access' };
  }
}

/**
 * Unbans a user from accessing specific content (for creator/admin use).
 */
export async function unbanUserFromContent(userId: string, contentId: string) {
  try {
    const session = await getAuthSession();
    
    if (!session?.user?.id) {
      return { error: 'Not authenticated' };
    }
    
    // Only creators and admins can unban
    if (session.user.role !== 'CREATOR' && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    
    // Check if the content belongs to the creator (if user is a creator)
    if (session.user.role === 'CREATOR') {
      const content = await prisma.content.findUnique({
        where: {
          id: contentId,
          creatorId: session.user.id
        }
      });
      
      if (!content) {
        return { error: 'Unauthorized. You can only unban users from your own content.' };
      }
    }
    
    await prisma.devToolsViolation.update({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      },
      data: {
        isBanned: false,
        warningCount: 0,
        bannedAt: null
      }
    });
    
    revalidatePath(`/content/${contentId}`);
    
    return { success: true, message: 'User has been unbanned successfully' };
  } catch (error) {
    console.error('Error unbanning user:', error);
    return { error: 'Failed to unban user' };
  }
}