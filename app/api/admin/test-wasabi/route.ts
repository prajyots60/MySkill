import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from 'fs';
import path from 'path';
import { uploadToWasabi, generatePresignedUploadUrl } from "@/lib/wasabi-storage";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Only allow admins to run this test
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Create a test file
    const testContent = `This is a test file created at ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent);
    
    // Generate a unique key for the test file
    const key = `tests/wasabi-integration-test-${Date.now()}.txt`;
    
    // Log config info
    const configInfo = {
      region: process.env.WASABI_REGION,
      endpoint: process.env.WASABI_ENDPOINT,
      bucket: process.env.WASABI_BUCKET,
      accessKeyConfigured: Boolean(process.env.WASABI_ACCESS_KEY),
      secretKeyConfigured: Boolean(process.env.WASABI_SECRET_KEY),
    };
    
    // Test direct upload
    console.log('Starting direct upload test with config:', configInfo);
    const uploadResult = await uploadToWasabi(key, testBuffer, 'text/plain', {
      testKey: 'testValue',
      timestamp: Date.now().toString()
    });
    
    // Test presigned URL generation
    console.log('Testing presigned URL generation');
    const presignedKey = `tests/wasabi-presigned-test-${Date.now()}.txt`;
    const presignedResult = await generatePresignedUploadUrl(presignedKey, 'text/plain', 3600);
    
    return NextResponse.json({
      success: true,
      message: "Wasabi integration tests passed successfully",
      uploadResult: {
        ...uploadResult,
        response: "Response data omitted for brevity"
      },
      presignedResult: {
        ...presignedResult,
        urlPreview: presignedResult.url.substring(0, 100) + '...'
      },
      configInfo
    });
  } catch (error) {
    console.error("Error testing Wasabi integration:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Wasabi integration test failed",
        error: error instanceof Error ? error.toString() : "Unknown error"
      },
      { status: 500 }
    );
  }
}
