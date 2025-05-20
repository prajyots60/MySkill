'use client';

import VideoDirectUploader from '@/components/video-direct-uploader';

export default function WasabiUploadPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Direct Video Upload to Wasabi</h1>
      <VideoDirectUploader />
    </div>
  );
} 