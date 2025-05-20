import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { uploadToWasabi } from '@/lib/wasabi-storage';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '@/lib/redis';

// Store jobs in memory for faster access but also in Redis for persistence
const uploadJobs = new Map();

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    const metadataStr = formData.get('metadata') as string;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'No category provided' },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata: Record<string, string> = {};
    try {
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
      }
    } catch (error) {
      console.error('Error parsing metadata:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid metadata format' },
        { status: 400 }
      );
    }

    // Add user ID to metadata
    metadata.userId = session.user.id;

    // Generate a unique job ID
    const jobId = uuidv4();

    // Create a job object
    const job = {
      id: jobId,
      status: 'processing',
      progress: 0,
      userId: session.user.id,
      file,
      category,
      metadata,
      error: null,
      result: null,
      createdAt: new Date(),
    };

    // Store the job in memory and Redis
    uploadJobs.set(jobId, job);
    await redis.set(`storage:upload:${jobId}`, JSON.stringify({
      ...job,
      file: null, // Don't store the file in Redis
    }), { ex: 86400 }); // Expire after 24 hours

    // Start processing the job in the background
    processUpload(jobId);

    // Return the job ID immediately
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Upload started',
    });
  } catch (error) {
    console.error('Error starting upload:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during upload' 
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get job ID from query params
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'No job ID provided' },
        { status: 400 }
      );
    }

    // Look for the job in memory first
    let job = uploadJobs.get(jobId);

    // If not found in memory, check Redis
    if (!job) {
      const jobData = await redis.get(`storage:upload:${jobId}`);
      if (!jobData) {
        return NextResponse.json(
          { success: false, error: 'Job not found' },
          { status: 404 }
        );
      }
      job = JSON.parse(jobData);
    }

    // Verify the user is authorized to access this job
    if (job.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this job' },
        { status: 403 }
      );
    }

    // Return the job status
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    console.error('Error checking upload status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while checking status' 
      },
      { status: 500 }
    );
  }
}

// Process the upload in the background
async function processUpload(jobId: string) {
  try {
    // Get the job
    const job = uploadJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Update job status
    job.status = 'uploading';
    job.progress = 20;
    await redis.set(`storage:upload:${jobId}`, JSON.stringify({
      ...job,
      file: null,
    }), { ex: 86400 });

    // Get the file data
    const file = job.file;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique file key
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${Date.now()}-${uuidv4()}.${fileExtension}`;
    const key = `${job.category}/${fileName}`;

    // Upload to Wasabi
    const result = await uploadToWasabi(key, buffer, file.type, job.metadata);

    // Update job status to completed
    job.status = 'completed';
    job.progress = 100;
    job.result = {
      key,
      url: result.url,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    };

    // Update Redis
    await redis.set(`storage:upload:${jobId}`, JSON.stringify({
      ...job,
      file: null,
    }), { ex: 86400 });

    // Clean up memory after a delay to allow clients to get the final status
    setTimeout(() => {
      uploadJobs.delete(jobId);
    }, 600000); // 10 minutes
  } catch (error) {
    console.error('Error processing upload:', error);

    // Get the job again in case it was updated while we were processing
    const job = uploadJobs.get(jobId);
    if (job) {
      // Update job status to failed
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';

      // Update Redis
      await redis.set(`storage:upload:${jobId}`, JSON.stringify({
        ...job,
        file: null,
      }), { ex: 86400 });
    }
  }
}