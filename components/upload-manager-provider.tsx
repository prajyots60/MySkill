'use client';

import React from 'react';
import { BackgroundUploadService } from './background-upload-service';
import { UploadManager } from './upload-manager';

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackgroundUploadService />
      <UploadManager />
      {children}
    </>
  );
}
