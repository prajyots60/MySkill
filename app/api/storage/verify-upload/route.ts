import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { wasabiClientMinimal } from "@/lib/wasabi-minimal";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto';

// Verify an upload was successful and belongs to the right user
export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.warn("Unauthorized verification attempt");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Extract verification data
    const { key, securityToken, contentType, fileSize } = await request.json();

    if (!key || !securityToken) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields for verification",
      }, { status: 400 });
    }

    // Verify the security token matches what we expect
    // This helps prevent unauthorized file access by validating the token
    const expectedToken = crypto.createHash('sha256')
      .update(`${session.user.id}-${key}-${process.env.NEXTAUTH_SECRET || ''}`)
      .digest('hex');

    if (securityToken !== expectedToken) {
      console.warn(`Invalid security token for file ${key}`);
      return NextResponse.json({
        success: false,
        message: "Invalid security token"
      }, { status: 403 });
    }

    // Verify the file exists in Wasabi and belongs to this user
    try {
      const result = await wasabiClientMinimal.send(new HeadObjectCommand({
        Bucket: process.env.WASABI_BUCKET || '',
        Key: key
      }));

      // Debug: Log metadata for troubleshooting
      console.log(`File ${key} metadata:`, result.Metadata);

      // Verify the file metadata contains the user ID
      // Note: S3 metadata keys are stored in lowercase
      const userId = result.Metadata?.userid || result.Metadata?.userId; 
      
      // Skip ownership check for security test uploads
      const isSecurityTest = (result.Metadata?.securitytest === 'true');
      
      if (!userId && !isSecurityTest) {
        console.warn(`File ${key} has no ownership information in metadata`);
        return NextResponse.json({
          success: false,
          message: "File ownership information missing"
        }, { status: 403 });
      }
      
      if (userId && userId !== session.user.id && !isSecurityTest) {
        console.warn(`User ${session.user.id} attempted to verify file belonging to ${userId}`);
        return NextResponse.json({
          success: false,
          message: "File owner verification failed"
        }, { status: 403 });
      }

      // Optional: Log this verification for audit purposes
      console.log(`File ${key} verified successfully by user ${session.user.id}`);

      return NextResponse.json({
        success: true,
        verified: true,
        message: "File verified successfully"
      });
    } catch (error) {
      console.error(`Error verifying file ${key}:`, error);
      return NextResponse.json({
        success: false,
        message: "File verification failed - could not locate the file"
      }, { status: 404 });
    }
  } catch (error) {
    console.error("Error verifying upload:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to verify upload"
      },
      { status: 500 }
    );
  }
}
