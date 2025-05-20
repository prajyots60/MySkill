import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { wasabiClient } from "@/lib/wasabi-storage";
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const bucketName = process.env.WASABI_BUCKET || '';
    
    if (!bucketName) {
      return NextResponse.json({ 
        success: false, 
        message: "Wasabi bucket name is not configured" 
      });
    }

    // Get the Wasabi client configuration for debugging
    const clientConfig = {
      region: process.env.WASABI_REGION || 'us-east-1',
      endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-east-1.wasabisys.com',
      accessKeyConfigured: Boolean(process.env.WASABI_ACCESS_KEY),
      secretKeyConfigured: Boolean(process.env.WASABI_SECRET_KEY),
    };

    console.log(`Testing bucket access for: ${bucketName} with region: ${clientConfig.region}, endpoint: ${clientConfig.endpoint}`);

    // Try to list the first few objects in the bucket
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5,
    });

    try {
      // Add a unique identifier to the request for tracing
      const requestId = `test-${Date.now().toString(36)}`;
      console.log(`[${requestId}] Sending ListObjectsV2Command to Wasabi`);
      
      const response = await wasabiClient.send(command);
      
      console.log(`[${requestId}] Successfully listed objects in bucket ${bucketName}`);
      
      return NextResponse.json({
        success: true,
        message: `Successfully accessed bucket ${bucketName}`,
        count: response.Contents?.length || 0,
        requestId
      });
    } catch (error) {
      console.error("Error accessing Wasabi bucket:", error);
      
      // Get detailed error information
      let errorMessage = "Unknown error";
      let errorCode = "Unknown";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // @ts-ignore - AWS errors often have a code property
        if (error.Code) errorCode = error.Code;
        // @ts-ignore - AWS errors also often have a name property
        if (error.name) errorCode = error.name;
      }
      
      return NextResponse.json({
        success: false,
        message: `Failed to access bucket: ${errorMessage}`,
        errorCode,
        config: clientConfig
      });
    }
  } catch (error) {
    console.error("Error in test-bucket-access route:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to test bucket access" 
      },
      { status: 500 }
    );
  }
}
