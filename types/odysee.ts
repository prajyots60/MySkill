import { VideoSource } from '@prisma/client';

// Type for Odysee video metadata
export interface OdyseeVideoMetadata {
  url: string;
  claimId: string;
  claimName: string;
  embedUrl: string;
  directUrl?: string;
  resolvedUrl?: string;
  title?: string;
  isUnlisted?: boolean;
  isDirectEmbed?: boolean;
  thumbnailUrl?: string;
  description?: string;
  duration?: number;
}

// Type for streamData field in Lecture model when videoSource is ODYSEE
export interface OdyseeStreamData {
  originalUrl: string;
  embedUrl: string;
  directUrl: string;
  isUnlisted: boolean;
  title?: string;
  thumbnailUrl?: string;
}

// Type for response from Odysee API
export interface OdyseeApiResponse {
  success: boolean;
  lecture: {
    id: string;
    title: string;
    type: string;
    claimId: string;
    claimName: string;
    videoSource: VideoSource;
    streamData?: OdyseeStreamData;
  };
}
