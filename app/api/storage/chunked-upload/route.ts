import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { redis } from '@/lib/redis';
import { uploadToWasabi } from '@/lib/wasabi-storage';
import { v4 as uuidv4 } from 'uuid';

// Store chunks in memory temporarily
const uploadChunks: Record<string, { 
  chunks: Buffer[],
  totalChunks: number,
  receivedChunks: number,
  fileKey: string,
  contentType: string,
  metadata: Record<string, string>,
  userId: string,
  expiresAt: number
}> = {};

// Clean up stale uploads periodically
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, upload] of Object.entries(uploadChunks)) {
    if (upload.expiresAt < now) {
      console.log(`Cleaning up stale upload ${uploadId}`);
      delete uploadChunks[uploadId];
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

/**
 * Handles the initialization of a chunked upload
 */
async function handleInitializeUpload(req: NextRequest, token: any) {
  try {
    const { totalChunks, fileKey, contentType, metadata = {} } = await req.json();
    
    if (!totalChunks || !fileKey || !contentType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create a new upload ID
    const uploadId = uuidv4();
    
    // Add user information to metadata
    const enhancedMetadata = {
      ...metadata,
      userId: token.sub as string,
      uploadedBy: token.email as string,
      uploadedAt: new Date().toISOString()
    };
    
    // Store the upload data
    uploadChunks[uploadId] = {
      chunks: new Array(totalChunks),
      totalChunks,
      receivedChunks: 0,
      fileKey,
      contentType,
      metadata: enhancedMetadata,
      userId: token.sub as string,
      expiresAt: Date.now() + (4 * 60 * 60 * 1000) // 4 hours expiration
    };
    
    // Also store in Redis for persistence across server restarts
    await redis.set(`chunked-upload:${uploadId}`, JSON.stringify({
      totalChunks,
      receivedChunks: 0,
      fileKey,
      contentType,
      metadata: enhancedMetadata,
      userId: token.sub,
      expiresAt: Date.now() + (4 * 60 * 60 * 1000)
    }), { ex: 14400 }); // 4 hours
    
    return NextResponse.json({
      success: true,
      uploadId,
      message: 'Upload initialized'
    });
  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * Handles uploading a chunk of a file
 */
async function handleUploadChunk(req: NextRequest, token: any) {
  try {
    const uploadId = req.nextUrl.searchParams.get('uploadId');
    const chunkIndex = parseInt(req.nextUrl.searchParams.get('chunkIndex') || '0', 10);
    
    if (!uploadId) {
      return NextResponse.json(
        { success: false, message: 'Missing upload ID' },
        { status: 400 }
      );
    }
    
    // Get the upload data
    const upload = uploadChunks[uploadId];
    if (!upload) {
      // Try to get from Redis
      const uploadData = await redis.get(`chunked-upload:${uploadId}`);
      if (!uploadData) {
        return NextResponse.json(
          { success: false, message: 'Upload not found or expired' },
          { status: 404 }
        );
      }
      
      // Restore from Redis
      const parsedData = JSON.parse(uploadData);
      uploadChunks[uploadId] = {
        ...parsedData,
        chunks: new Array(parsedData.totalChunks)
      };
    }
    
    // Verify user owns this upload
    if (upload.userId !== token.sub) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Check chunk index
    if (chunkIndex < 0 || chunkIndex >= upload.totalChunks) {
      return NextResponse.json(
        { success: false, message: 'Invalid chunk index' },
        { status: 400 }
      );
    }
    
    // Get the chunk data
    const data = await req.arrayBuffer();
    const buffer = Buffer.from(data);
    
    // Store the chunk
    upload.chunks[chunkIndex] = buffer;
    upload.receivedChunks++;
    
    // Update Redis
    await redis.set(`chunked-upload:${uploadId}:chunk:${chunkIndex}`, 'received', { ex: 14400 });
    await redis.set(`chunked-upload:${uploadId}`, JSON.stringify({
      ...upload,
      chunks: null, // Don't store the actual chunks in Redis
      receivedChunks: upload.receivedChunks
    }), { ex: 14400 });
    
    // Check if all chunks have been received
    if (upload.receivedChunks === upload.totalChunks) {
      // Combine all chunks
      const combinedBuffer = Buffer.concat(upload.chunks);
      
      // Upload to Wasabi
      const result = await uploadToWasabi(
        upload.fileKey,
        combinedBuffer,
        upload.contentType,
        upload.metadata
      );
      
      // Clean up
      delete uploadChunks[uploadId];
      await redis.del(`chunked-upload:${uploadId}`);
      for (let i = 0; i < upload.totalChunks; i++) {
        await redis.del(`chunked-upload:${uploadId}:chunk:${i}`);
      }
      
      return NextResponse.json({
        success: true,
        complete: true,
        url: result.url,
        key: result.key,
        message: 'Upload complete'
      });
    }
    
    return NextResponse.json({
      success: true,
      complete: false,
      receivedChunks: upload.receivedChunks,
      totalChunks: upload.totalChunks,
      message: `Chunk ${chunkIndex} received`
    });
  } catch (error) {
    console.error('Error uploading chunk:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET status of a chunked upload
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const uploadId = req.nextUrl.searchParams.get('uploadId');
    if (!uploadId) {
      return NextResponse.json(
        { success: false, message: 'Missing upload ID' },
        { status: 400 }
      );
    }
    
    // Check in memory first
    let upload = uploadChunks[uploadId];
    
    // If not in memory, try Redis
    if (!upload) {
      const uploadData = await redis.get(`chunked-upload:${uploadId}`);
      if (!uploadData) {
        return NextResponse.json(
          { success: false, message: 'Upload not found or expired' },
          { status: 404 }
        );
      }
      
      upload = JSON.parse(uploadData);
    }
    
    // Verify user owns this upload
    if (upload.userId !== token.sub) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      status: {
        receivedChunks: upload.receivedChunks,
        totalChunks: upload.totalChunks,
        fileKey: upload.fileKey,
        contentType: upload.contentType,
        complete: upload.receivedChunks === upload.totalChunks
      }
    });
  } catch (error) {
    console.error('Error checking upload status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for initializing or uploading chunks
 */
export async function POST(req: NextRequest) {
  // Verify authentication
  const token = await getToken({ req });
  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const action = req.nextUrl.searchParams.get('action');
  
  if (action === 'initialize') {
    return handleInitializeUpload(req, token);
  } else if (action === 'upload') {
    return handleUploadChunk(req, token);
  } else {
    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  }
}
