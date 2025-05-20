/**
 * Security configuration for file storage
 * This file centralizes security settings for Wasabi storage
 */

// Video upload security settings
export const UPLOAD_SECURITY = {
  // Allowed video content types
  ALLOWED_CONTENT_TYPES: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/x-ms-wmv',
    'video/mpeg'
  ],
  
  // Maximum file size (10GB)
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024,
  
  // Presigned URL expiration (in seconds)
  PRESIGNED_URL_EXPIRATION: 3600, // 1 hour
  
  // Rate limiting settings
  RATE_LIMITS: {
    // Presigned URL generation
    PRESIGNED_URL: {
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
    },
    
    // Upload completion
    UPLOAD_COMPLETE: {
      limit: 5,
      windowMs: 60 * 1000, // 1 minute
    },
    
    // File access
    FILE_ACCESS: {
      limit: 50,
      windowMs: 60 * 1000, // 1 minute
    }
  },
  
  // Security token settings
  TOKEN_SETTINGS: {
    // How long authentication tokens are valid (in seconds)
    TOKEN_EXPIRATION: 86400, // 24 hours
  },
  
  // Encryption settings
  ENCRYPTION: {
    // Default encryption algorithm
    ALGORITHM: 'AES-GCM',
    
    // Key size in bits
    KEY_SIZE: 256,
    
    // IV length in bytes
    IV_LENGTH: 12,
    
    // Authentication tag length in bits
    TAG_LENGTH: 128
  }
};

// File access security settings
export const ACCESS_SECURITY = {
  // Default expiration for access URLs (in seconds)
  DEFAULT_URL_EXPIRATION: 3600, // 1 hour
  
  // Extended expiration for streaming URLs (in seconds)
  STREAMING_URL_EXPIRATION: 86400, // 24 hours
  
  // Cookie settings for secure video playback
  SECURE_COOKIE: {
    name: 'vt', // video token
    maxAge: 3600, // 1 hour
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
    sameSite: 'strict'
  }
};

// Access control settings
export const ACCESS_CONTROL = {
  // Allowed roles for upload
  UPLOADER_ROLES: ['CREATOR', 'ADMIN'],
  
  // Allowed roles for management
  MANAGER_ROLES: ['ADMIN'],
  
  // Default permissions for new users
  DEFAULT_PERMISSIONS: {
    canUpload: false,
    canDownload: false,
    canDelete: false,
    maxStorageGB: 0
  }
};

// Audit settings
export const AUDIT_SETTINGS = {
  // Enable detailed audit logging
  ENABLE_AUDIT: true,
  
  // Events to track
  TRACK_EVENTS: [
    'UPLOAD_START',
    'UPLOAD_COMPLETE',
    'UPLOAD_FAILED',
    'FILE_ACCESS',
    'FILE_DELETED'
  ]
};
