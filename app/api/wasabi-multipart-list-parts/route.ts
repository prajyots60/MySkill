import { NextResponse } from 'next/server';
import { S3 } from '@aws-sdk/client-s3';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const uploadId = url.searchParams.get('uploadId');

    if (!key || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Initialize S3 client for Wasabi
    const s3 = new S3({
      endpoint: `https://s3.${process.env.NEXT_PUBLIC_WASABI_REGION}.wasabisys.com`,
      region: process.env.NEXT_PUBLIC_WASABI_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || '',
      },
    });

    // List the parts that have been uploaded for this multipart upload
    const listPartsResult = await s3.listParts({
      Bucket: process.env.NEXT_PUBLIC_WASABI_BUCKET as string,
      Key: key,
      UploadId: uploadId,
      MaxParts: 10000, // Maximum number of parts to list
    });

    return NextResponse.json({
      parts: listPartsResult.Parts || [],
    });
  } catch (error) {
    console.error('Error listing multipart upload parts:', error);
    return NextResponse.json(
      { error: 'Failed to list parts', details: (error as Error).message },
      { status: 500 }
    );
  }
}
