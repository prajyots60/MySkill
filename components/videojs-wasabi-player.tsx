'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';
import '@videojs/http-streaming';
import 'videojs-contrib-quality-levels';

interface VideoJsWasabiPlayerProps {
  fileUrl: string;
  title?: string;
  isEncrypted?: boolean;
  encryptionKey?: string;
  posterUrl?: string;
  autoplay?: boolean;
  className?: string;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
}

// Helper function to validate presigned URL
const validatePresignedUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const requiredParams = [
      'X-Amz-Algorithm',
      'X-Amz-Credential',
      'X-Amz-Date',
      'X-Amz-Expires',
      'X-Amz-SignedHeaders',
      'X-Amz-Signature'
    ];

    // Check all required parameters
    const missingParams = requiredParams.filter(param => !urlObj.searchParams.has(param));
    if (missingParams.length > 0) {
      console.warn('Missing required presigned URL parameters:', missingParams);
      return false;
    }

    // Check if URL has already expired
    const dateStr = urlObj.searchParams.get('X-Amz-Date');
    const expiresIn = Number(urlObj.searchParams.get('X-Amz-Expires'));
    
    if (dateStr && expiresIn) {
      const date = new Date(`${dateStr.slice(0, 8)}T${dateStr.slice(8, 14)}Z`);
      const expirationTime = date.getTime() + (expiresIn * 1000);
      if (Date.now() > expirationTime) {
        console.warn('Presigned URL has expired');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('URL validation error:', error);
    return false;
  }
};

// Helper function to validate encryption key
function validateEncryptionKey(key: string | undefined): { isValid: boolean; error?: string } {
  if (!key) {
    return { isValid: false, error: 'No encryption key provided' };
  }

  const keyValidation = {
    isHex: /^[0-9a-fA-F]+$/.test(key),
    validLength: key.length === 64 || key.length === 32, // Support both 256-bit and 128-bit keys
    nonHexChars: key.match(/[^0-9a-fA-F]/g)
  };

  if (!keyValidation.isHex) {
    return { 
      isValid: false, 
      error: `Invalid encryption key format: contains non-hex characters ${keyValidation.nonHexChars?.join(', ')}` 
    };
  }

  if (!keyValidation.validLength) {
    return { 
      isValid: false, 
      error: `Invalid encryption key length: expected 32 or 64 hex characters, got ${key.length}` 
    };
  }

  return { isValid: true };
}

export default function VideoJsWasabiPlayer({
  fileUrl,
  title,
  isEncrypted = false,
  encryptionKey,
  className = ''
}: VideoJsWasabiPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const decryptedBlobRef = useRef<{ sourceUrl: string | null, url: string | null, blob: Blob | null }>({ sourceUrl: null, url: null, blob: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const playerInitializedRef = useRef(false);

  // Handle cleanup of videoplayer and blob URLs - this function shouldn't cause re-renders
  const cleanup = useCallback(() => {
    if (playerRef.current) {
      console.log('Disposing existing player instance');
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (decryptedBlobRef.current.url) {
      URL.revokeObjectURL(decryptedBlobRef.current.url);
      decryptedBlobRef.current = { sourceUrl: null, url: null, blob: null };
    }
    playerInitializedRef.current = false;
  }, []); // Empty dependency array since it doesn't depend on any state or props

  // Function to create a proper video blob with better MIME type detection
  const createVideoBlob = useCallback((data: ArrayBuffer): Blob => {
    // Magic numbers for different video formats
    const signatures = {
      mp4: [[0x66, 0x74, 0x79, 0x70], [0x6D, 0x6F, 0x6F, 0x76]], // ftyp or moov
      webm: [0x1A, 0x45, 0xDF, 0xA3],
      avi: [0x52, 0x49, 0x46, 0x46], // RIFF
      mkv: [0x1A, 0x45, 0xDF, 0xA3], // Same as webm
      mov: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20] // ftyp qt
    };
    
    const header = new Uint8Array(data.slice(0, 16));
    let mimeType = 'video/mp4'; // default

    // Check for MP4 signatures
    const isMP4 = signatures.mp4.some(sig => 
      header.slice(4, 8).every((byte, i) => byte === sig[i])
    );
    if (isMP4) {
      mimeType = 'video/mp4';
    }
    // Check for WebM/MKV signature
    else if (
      header[0] === signatures.webm[0] &&
      header[1] === signatures.webm[1] &&
      header[2] === signatures.webm[2] &&
      header[3] === signatures.webm[3]
    ) {
      mimeType = 'video/webm';
    }
    // Check for AVI signature
    else if (
      header[0] === signatures.avi[0] &&
      header[1] === signatures.avi[1] &&
      header[2] === signatures.avi[2] &&
      header[3] === signatures.avi[3]
    ) {
      mimeType = 'video/x-msvideo';
    }
    // Check for MOV signature
    else if (
      header.slice(4, 12).every((byte, i) => byte === signatures.mov[i])
    ) {
      mimeType = 'video/quicktime';
    }

    console.log('Detected MIME type:', mimeType);
    return new Blob([data], { type: mimeType });
  }, []);

  // Player initialization function - memoized with empty dependency array
  const initializePlayer = useCallback((url: string) => {
    try {
      if (!videoRef.current || !mountedRef.current) {
        console.error('Video element not found or component unmounted');
        return;
      }

      // Skip initialization if we're already initialized with this URL
      if (playerInitializedRef.current && playerRef.current) {
        console.log('Player already initialized, skipping re-initialization');
        return;
      }

      // Create video element only once
      console.log('Initializing player with URL:', url);
      
      // Clear the videoRef container once
      if (videoRef.current.firstChild) {
        console.log('Video container already has children, reusing existing container');
      } else {
        // Create the video element
        const videoElement = document.createElement('video');
        videoElement.className = 'video-js vjs-default-skin';
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('controls', '');
        videoElement.setAttribute('crossorigin', 'anonymous'); 
        videoElement.id = 'video-js-player-' + Date.now(); // Unique ID to prevent conflicts
        videoRef.current.appendChild(videoElement);
      }

      // Determine MIME type
      let sourceType = 'video/mp4';
      if (url.includes('.mp4')) sourceType = 'video/mp4';
      if (url.includes('.webm')) sourceType = 'video/webm';
      if (url.includes('.mov')) sourceType = 'video/quicktime';
      if (url.includes('.m3u8')) sourceType = 'application/x-mpegURL';
      
      // Add advanced configuration
      const playerOptions = {
        controls: true,
        fluid: true,
        preload: 'auto',
        playsinline: true,
        crossOrigin: 'anonymous', // Add CORS support
        html5: {
          vhs: {
            overrideNative: true, // Better handling for HLS
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
          nativeTextTracks: false
        },
        sources: [{
          src: url,
          type: sourceType
        }]
      };

      // Find the video element in our container to initialize
      const videoElement = videoRef.current.querySelector('video');
      if (!videoElement) {
        throw new Error('Video element not found in container');
      }

      console.log('Creating VideoJS player with element:', videoElement);
      
      // Dispose any existing player instance before creating a new one
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }

      const player = videojs(videoElement, playerOptions, function onPlayerReady() {
        console.log('Player is ready');
        playerInitializedRef.current = true;
        
        // Immediately check for playability when ready
        this.one('loadedmetadata', () => {
          console.log('Video metadata loaded, dimensions:', {
            width: this.videoWidth(),
            height: this.videoHeight(),
            duration: this.duration()
          });
          if (mountedRef.current) {
            setLoading(false);
          }
        });
      });

      // Add robust error handling
      player.on('error', () => {
        const error = player.error();
        console.error('Video.js error:', error);
        console.error('Video element error code:', videoElement.error && videoElement.error.code);
        
        // Try to recover by resetting the source
        if (error && error.code === 4) { // Media error
          console.log('Attempting to recover from media error...');
          player.src({ src: url, type: sourceType });
          player.load();
          
          // Give the player a second chance
          setTimeout(() => {
            if (mountedRef.current && player.error()) {
              setError('Video playback error. Please reload the page and try again.');
            }
          }, 3000);
        } else if (mountedRef.current) {
          setError(`Video error: ${error?.message || 'Unknown playback error'}`);
        }
      });

      // Handle all player events with detailed logging
      player.on('loadstart', () => {
        console.log('Video load started');
        // Don't set loading to true here, as it would cause a re-render
      });
      
      player.on('progress', () => {
        const buffered = player.buffered();
        const duration = player.duration && typeof player.duration === 'function' ? player.duration() : undefined;
        if (buffered && buffered.length > 0 && duration !== undefined) {
          console.log('Video downloading - buffered:',
            buffered.end(buffered.length - 1).toFixed(2) + 's',
            'of', duration !== undefined ? duration.toFixed(2) + 's' : 'unknown duration');
        }
      });
      
      player.on('loadeddata', () => {
        console.log('Video data loaded successfully');
        if (mountedRef.current) {
          setLoading(false);
        }
      });
      
      player.on('canplay', () => {
        console.log('Video can start playing');
        if (mountedRef.current) {
          setLoading(false);
          setError(null); // Clear any previous errors when video is ready
        }
      });
      
      player.on('playing', () => {
        console.log('Video playback started');
        if (mountedRef.current) {
          setLoading(false);
          setError(null);
        }
      });
      
      player.on('waiting', () => console.log('Video playback waiting'));
      
      player.on('seeking', () => {
        const t = player.currentTime();
        console.log('Video seeking to:', t !== undefined ? t.toFixed(2) : 'unknown');
      });
      player.on('seeked', () => {
        const t = player.currentTime();
        console.log('Video seeked to:', t !== undefined ? t.toFixed(2) : 'unknown');
      });
      
      playerRef.current = player;
    } catch (err) {
      console.error('Error initializing player:', err);
      if (mountedRef.current) {
        setError('Failed to initialize video player');
        setLoading(false);
      }
    }
  }, []); // Empty dependency array to prevent recreation

  // Handle initialization of video player - stable reference with no dependencies
  const handleInitializePlayer = useCallback((url: string) => {
    if (!videoRef.current || !mountedRef.current) return;
    
    console.log('Starting player initialization with URL:', url);
    
    // Skip re-initialization if already initialized with this URL
    if (playerInitializedRef.current && playerRef.current) {
      if (playerRef.current.currentSrc() === url) {
        console.log('Player already initialized with this URL, skipping initialization');
        setLoading(false);
        return;
      }
    }
    
    // Cleanup only if we need to re-initialize
    cleanup();
    
    // Let video.js handle the video element creation
    initializePlayer(url);
  }, [cleanup, initializePlayer]);

  // Main effect to load and decrypt video - with minimal dependencies
  useEffect(() => {
    console.log('Main video loading effect running');
    mountedRef.current = true;
    playerInitializedRef.current = false;

    // Debounce to prevent multiple rapid requests
    const loadVideoTimer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        // Input validation
        if (!fileUrl) {
          throw new Error('No video URL provided');
        }

        if (!validatePresignedUrl(fileUrl)) {
          throw new Error('Invalid or expired video URL');
        }

        // Check for encryption status and provide clear logging
        console.log('Video encryption status:', { 
          isEncrypted, 
          hasKey: !!encryptionKey,
          keyLength: encryptionKey?.length, 
          fileUrl: fileUrl.substring(0, 100) + (fileUrl.length > 100 ? '...' : '')
        });
        
        // Enhanced encryption key validation - only if explicitly marked as encrypted
        if (isEncrypted === true) {
          const keyValidation = validateEncryptionKey(encryptionKey);
          if (!keyValidation.isValid) {
            throw new Error(keyValidation.error);
          }

          console.log('Encryption key validated:', {
            length: encryptionKey!.length,
            sample: encryptionKey!.substring(0, 8) + '...',
            type: 'AES-256'
          });
        } else {
          // If isEncrypted is false or undefined, make sure we treat it as not encrypted
          console.log('Video not encrypted or not explicitly marked as encrypted, will load directly');
        }

        // If we already have the decrypted blob for this URL and key, reuse it
        const currentBlob = decryptedBlobRef.current;
        if (currentBlob.blob && currentBlob.url && currentBlob.sourceUrl === fileUrl) {
          console.log('Reusing existing decrypted blob');
          if (!mountedRef.current) return;
          handleInitializePlayer(currentBlob.url);
          return;
        }

        let finalUrl: string;
        
        // Check explicitly if the video is encrypted before attempting decryption
        if (isEncrypted === true && encryptionKey) {
          console.log('Fetching encrypted video...');
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status}`);
          }
          
          const encryptedBlob = await response.blob();
          console.log('Decrypting video...', { size: encryptedBlob.size });
          let decryptedBlob = await decryptFile(encryptedBlob, encryptionKey);
          
          // Validate the decrypted video is playable
          console.log('Validating decrypted video...', { size: decryptedBlob.size, type: decryptedBlob.type });
          
          // Save first few bytes for debugging
          const debugHeader = new Uint8Array(await decryptedBlob.slice(0, 32).arrayBuffer());
          console.log('Decrypted header:', Array.from(debugHeader).map(b => b.toString(16).padStart(2, '0')).join(' '));
          
          const validation = await validateVideoPlayability(decryptedBlob);
          if (!validation.isValid) {
            // If validation fails, try forcing the MIME type to video/mp4
            const forcedBlob = new Blob([await decryptedBlob.arrayBuffer()], { type: 'video/mp4' });
            console.log('Retrying validation with forced MIME type...');
            const retryValidation = await validateVideoPlayability(forcedBlob);
            if (!retryValidation.isValid) {
              throw new Error(`Invalid video file: ${validation.error}`);
            }
            decryptedBlob = forcedBlob;
          }
          
          // Make sure any existing blob URL is revoked before creating a new one
          if (decryptedBlobRef.current.url) {
            URL.revokeObjectURL(decryptedBlobRef.current.url);
          }
          
          // Create a new object URL and store the blob reference with the source URL
          finalUrl = URL.createObjectURL(decryptedBlob);
          console.log('Created blob URL for decrypted video size:', decryptedBlob.size);
          
          // Store the references before initializing player
          decryptedBlobRef.current = { sourceUrl: fileUrl, url: finalUrl, blob: decryptedBlob };
          
          // Verify the blob is accessible
          try {
            const blobTest = await fetch(finalUrl);
            if (!blobTest.ok) throw new Error('Blob URL not accessible');
            console.log('Blob URL verified as accessible');
          } catch (err) {
            console.error('Blob URL verification failed:', err);
            throw new Error('Failed to create valid video source');
          }
        } else {
          // For non-encrypted videos, use the URL directly
          console.log('Loading non-encrypted video directly from URL:', fileUrl);
          finalUrl = fileUrl;
          decryptedBlobRef.current = { sourceUrl: fileUrl, url: null, blob: null };
        }

        // Check if component is still mounted before initializing player
        if (!mountedRef.current) return;

        console.log('Initializing player with URL:', finalUrl);
        handleInitializePlayer(finalUrl);
      } catch (err) {
        console.error('Error loading video:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load video');
          setLoading(false);
        }
      }
    }, 100); // Small debounce to prevent multiple rapid requests

    return () => {
      console.log('Cleaning up main effect');
      clearTimeout(loadVideoTimer);
      mountedRef.current = false;
      cleanup();
    };
  }, [fileUrl, isEncrypted, encryptionKey, handleInitializePlayer, cleanup]); // Stable dependencies

  // We'll keep the player visible while loading so video.js can handle the loading state
  // This prevents the player from being torn down and recreated which can cause issues
  
  return (
    <div className={`video-container relative ${className}`} style={{ aspectRatio: '16/9' }}>
      {/* Player container is always rendered */}
      <div ref={videoRef} data-vjs-player className="w-full h-full">
        {/* Video.js will create the video element */}
      </div>
      
      {/* Overlay loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"/>
            <p className="text-white text-sm">Loading video...</p>
          </div>
        </div>
      )}
      
      {/* Error message overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20">
          <div className="flex flex-col items-center gap-3 max-w-md mx-auto p-4 text-center">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-white text-sm">{error}</p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              onClick={() => {
                setError(null);
                setLoading(true);
                // Re-initialize the player with the same URL
                if (fileUrl) {
                  setTimeout(() => handleInitializePlayer(fileUrl), 100);
                }
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to normalize encryption key
function normalizeEncryptionKey(key: string): Uint8Array {
  // Convert string to bytes if needed
  let bytes: Uint8Array;
  
  console.log('Normalizing key of length:', key.length, 'format:', 
    key.length === 32 ? 'Raw 32-byte string' :
    (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) ? 'Hex string' :
    (key.length === 44 && /^[A-Za-z0-9+/=]+$/.test(key)) ? 'Base64' :
    'Unknown format'
  );
  
  try {
    if (key.length === 32) { // Raw 32-byte key
      bytes = new TextEncoder().encode(key);
    } else if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) { // Hex string
      bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(key.substr(i * 2, 2), 16);
      }
      console.log('Key parsed from hex string, first 4 bytes:', Array.from(bytes.slice(0, 4)));
    } else if (key.length === 44 && /^[A-Za-z0-9+/=]+$/.test(key)) { // Base64
      try {
        const binary = atob(key);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        console.log('Key parsed from base64, length:', bytes.length);
      } catch (e) {
        console.error('Base64 decoding failed:', e);
        throw new Error('Invalid base64 encoding in encryption key');
      }
    } else if (/^[0-9a-fA-F]+$/.test(key)) { // Any hex string, not just 64 chars
      // Ensure we have an even number of hex chars
      const normalizedHex = key.length % 2 === 0 ? key : '0' + key;
      const byteLength = normalizedHex.length / 2;
      bytes = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) {
        bytes[i] = parseInt(normalizedHex.substr(i * 2, 2), 16);
      }
      console.log('Key parsed from variable-length hex string, length:', bytes.length, 'bytes');
      
      // Ensure proper key size (32 bytes for AES-256)
      if (bytes.length < 32) {
        // If key is too short, extend it by repeating
        const extendedBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          extendedBytes[i] = bytes[i % bytes.length];
        }
        bytes = extendedBytes;
        console.log('Key extended to 32 bytes');
      } else if (bytes.length > 32) {
        // If key is too long, truncate
        bytes = bytes.slice(0, 32);
        console.log('Key truncated to 32 bytes');
      }
    } else {
      // Convert to SHA-256 hash if not in any standard format
      console.log('Converting non-standard key to SHA-256 hash');
      // Use a simpler approach for hash calculation to avoid recursion
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      
      // Simple string-based hash for now (this is not secure, just for format conversion)
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data[i];
        hash |= 0;
      }
      
      // Convert hash to byte array and extend to 32 bytes
      bytes = new Uint8Array(32);
      let tempHash = Math.abs(hash);
      for (let i = 0; i < 32; i++) {
        bytes[i] = tempHash % 256;
        tempHash = Math.floor(tempHash / 256) + (i * 11);
      }
      
      console.log('Generated key from hash, first 4 bytes:', Array.from(bytes.slice(0, 4)));
    }

    // Ensure key is exactly 32 bytes (256 bits)
    if (bytes.length !== 32) {
      console.warn(`Key length mismatch after normalization: ${bytes.length} bytes, adjusting to 32 bytes`);
      const adjustedBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        adjustedBytes[i] = i < bytes.length ? bytes[i] : bytes[i % bytes.length];
      }
      bytes = adjustedBytes;
    }
  } catch (error) {
    console.error('Key normalization error:', error);
    throw new Error(`Failed to normalize encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return bytes;
}

// Helper function to detect video format from header bytes
function detectVideoFormat(header: Uint8Array): string {
  // Check for more common video format signatures
  const signatures = {
    mp4: [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
      { offset: 4, bytes: [0x6D, 0x6F, 0x6F, 0x76] }, // moov
      { offset: 0, bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70] } // ISO Base Media
    ],
    webm: [
      { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] } // EBML header
    ],
    avi: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] } // RIFF
    ],
    mov: [
      { offset: 4, bytes: [0x6D, 0x6F, 0x6F, 0x76] }, // moov
      { offset: 4, bytes: [0x66, 0x72, 0x65, 0x65] }  // free
    ]
  };

  if (header.length < 16) {
    console.warn('Header too short for reliable format detection');
    return 'video/mp4'; // Default fallback
  }

  console.log('Analyzing file header:', {
    hex: Array.from(header.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '),
    ascii: Array.from(header.slice(0, 16)).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('')
  });

  // Check for MP4/MOV variants
  for (const sig of signatures.mp4) {
    if (header.length >= sig.offset + sig.bytes.length &&
        sig.bytes.every((byte, i) => header[sig.offset + i] === byte)) {
      // For MP4, try to determine specific brand
      if (header.length >= sig.offset + 8) {
        const brand = String.fromCharCode(
          ...header.slice(sig.offset + 8, sig.offset + 12)
        );
        switch (brand) {
          case 'qt  ': return 'video/quicktime';
          case 'M4V ': return 'video/x-m4v';
          case 'mp42':
          case 'mp41':
          case 'isom':
          case 'avc1': return 'video/mp4';
        }
      }
      return 'video/mp4';
    }
  }

  // Check for WebM
  for (const sig of signatures.webm) {
    if (header.length >= sig.offset + sig.bytes.length &&
        sig.bytes.every((byte, i) => header[sig.offset + i] === byte)) {
      return 'video/webm';
    }
  }

  // Check for AVI
  for (const sig of signatures.avi) {
    if (header.length >= sig.offset + sig.bytes.length &&
        sig.bytes.every((byte, i) => header[sig.offset + i] === byte)) {
      return 'video/x-msvideo';
    }
  }

  // Check for MOV
  for (const sig of signatures.mov) {
    if (header.length >= sig.offset + sig.bytes.length &&
        sig.bytes.every((byte, i) => header[sig.offset + i] === byte)) {
      return 'video/quicktime';
    }
  }

  // If no matches but we see some video-like patterns, try mp4
  if (header.includes(0x66) && header.includes(0x74) && header.includes(0x79)) { // 'fty'
    console.log('Possible corrupted MP4 header, using video/mp4');
    return 'video/mp4';
  }

  console.warn('Could not definitively determine video format, defaulting to MP4');
  return 'video/mp4';
}

// Helper function to decrypt a file
function decryptFile(encryptedBlob: Blob, keyString: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read encrypted file');
          }
          
          const data = event.target.result as ArrayBuffer;
          
          if (data.byteLength < 16) {
            throw new Error('File is too small to be a valid encrypted video');
          }

          const keyBytes = normalizeEncryptionKey(keyString);
          console.log('Using encryption key:', {
            originalLength: keyString.length,
            normalizedLength: keyBytes.length,
            firstFewBytes: Array.from(keyBytes.slice(0, 4))
          });

          // Extract IV (first 16 bytes) from the encrypted data
          const iv = new Uint8Array(data.slice(0, 16));

          console.log('Decryption parameters:', {
            ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' ')
          });

          let decryptedData: ArrayBuffer | undefined;
          let format: string;
          
          // Try AES-GCM first (matches API configuration)
          try {
            console.log('Attempting AES-GCM decryption');
            
            // Import the key for AES-GCM
            const gcmKey = await window.crypto.subtle.importKey(
              'raw', 
              keyBytes, 
              { 
                name: 'AES-GCM',
                length: 256
              }, 
              false, 
              ['decrypt']
            );
            
            // For GCM, use only the first 12 bytes of IV
            const gcmIv = iv.slice(0, 12);
            console.log('GCM IV (12 bytes):', Array.from(gcmIv).map(b => b.toString(16).padStart(2, '0')).join(' '));
            
            // Check if there's an authentication tag at the end of the data
            // The encrypted data might have the auth tag appended at the end
            // Standard format: IV (16 bytes) + Encrypted content + Auth Tag (16 bytes)
            // Try decrypting with auth tag expected to be part of the ciphertext
            try {
              // Decrypt with AES-GCM
              decryptedData = await window.crypto.subtle.decrypt(
                {
                  name: 'AES-GCM',
                  iv: gcmIv,
                  tagLength: 128
                },
                gcmKey,
                data.slice(16) // Skip IV bytes
              );
              
              console.log('AES-GCM decryption successful!');
            } catch (innerError) {
              console.log('Standard AES-GCM failed, trying different tag handling:', innerError);
              
              // Try with different lengths of IV or different interpretations of the data structure
              // Some implementations may store the tag differently or use different IV sizes
              
              // Alternative 1: Try using full 16-byte IV for GCM
              decryptedData = await window.crypto.subtle.decrypt(
                {
                  name: 'AES-GCM',
                  iv: iv, // Use full 16 bytes
                  tagLength: 128
                },
                gcmKey,
                data.slice(16) // Skip IV bytes
              );
              
              console.log('AES-GCM with full IV decryption successful!');
            }
          } catch (gcmError) {
            console.log('AES-GCM decryption failed, trying AES-CBC:', gcmError);
            
            try {
              // Fall back to CBC if GCM fails
              const cbcKey = await window.crypto.subtle.importKey(
                'raw', 
                keyBytes, 
                { 
                  name: 'AES-CBC',
                  length: 256
                }, 
                false, 
                ['decrypt']
              );

              console.log('CBC IV (16 bytes):', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '));
              console.log('Encrypted data first 32 bytes:', Array.from(new Uint8Array(data.slice(16, 48))).map(b => b.toString(16).padStart(2, '0')).join(' '));
              
              // Decrypt the data with AES-CBC (using full 16-byte IV)
              try {
                decryptedData = await window.crypto.subtle.decrypt(
                  {
                    name: 'AES-CBC',
                    iv
                  },
                  cbcKey,
                  data.slice(16) // Skip IV bytes
                );
                
                console.log('AES-CBC decryption successful!');
              } catch (standardCbcError) {
                console.log('Standard AES-CBC failed, trying padding variations:', standardCbcError);
                
                // Try different binary structures - some implementations have different formats
                // Some might include mode prefix in first few bytes or padding info
                // Try with offset IV positions
                const alternativeIv = new Uint8Array(data.slice(0, 16));
                
                // Try different positions for IV
                for (let offset of [8, 4, 12]) {
                  try {
                    console.log(`Trying CBC with ${offset}-byte offset IV`);
                    const offsetIv = new Uint8Array(data.slice(offset, offset + 16));
                    
                    decryptedData = await window.crypto.subtle.decrypt(
                      {
                        name: 'AES-CBC',
                        iv: offsetIv
                      },
                      cbcKey,
                      data.slice(offset + 16) // Skip offset + IV bytes
                    );
                    
                    console.log(`AES-CBC with ${offset}-byte offset IV successful!`);
                    break;
                  } catch (offsetError) {
                    console.log(`AES-CBC with ${offset}-byte offset failed:`, offsetError);
                  }
                }
                
                if (!decryptedData) {
                  throw new Error('All CBC variations failed');
                }
              }
            } catch (cbcError) {
              console.error('Both AES-GCM and AES-CBC decryption failed:', cbcError);
              
              // Add more diagnostic information before giving up
              console.error('Encryption diagnostic information:', {
                ivLength: iv.length,
                dataLength: data.byteLength,
                keyLength: keyBytes.length * 8 + ' bits'
              });
              
              // As a last resort, try without IV (some systems use fixed/derived IVs)
              try {
                console.log('Last resort: Trying AES-CBC with zero IV');
                const zeroIv = new Uint8Array(16); // All zeros
                
                const lastResortKey = await window.crypto.subtle.importKey(
                  'raw', 
                  keyBytes, 
                  { 
                    name: 'AES-CBC',
                    length: 256
                  }, 
                  false, 
                  ['decrypt']
                );
                
                decryptedData = await window.crypto.subtle.decrypt(
                  {
                    name: 'AES-CBC',
                    iv: zeroIv
                  },
                  lastResortKey,
                  data
                );
                
                console.log('Zero IV decryption successful (unusual)!');
              } catch (finalError) {
                throw new Error('Unable to decrypt video with either AES-GCM or AES-CBC - tried multiple methods');
              }
            }
          }
          
          // Log the first bytes of the decrypted data for debugging
          const headerBytes = new Uint8Array(decryptedData.slice(0, 32));
          console.log('Decrypted header:', Array.from(headerBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
          
          // Check for MP4 signature in the first 32 bytes (ftyp)
          const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // "ftyp"
          let hasFtyp = false;
          
          for (let i = 0; i < 16; i++) {
            if (i + 4 < headerBytes.length) {
              if (headerBytes[i] === ftypSignature[0] && 
                  headerBytes[i+1] === ftypSignature[1] && 
                  headerBytes[i+2] === ftypSignature[2] && 
                  headerBytes[i+3] === ftypSignature[3]) {
                hasFtyp = true;
                console.log('Found MP4 ftyp signature at offset:', i);
                break;
              }
            }
          }
          
          // Set proper MIME type and create blob
          format = hasFtyp ? 'video/mp4' : detectVideoFormat(headerBytes);
          console.log('Using format:', format);
          
          const decryptedBlob = new Blob([decryptedData], { type: format });
          resolve(decryptedBlob);
        } catch (err) {
          console.error('Decryption error:', err);
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read encrypted file'));
      reader.readAsArrayBuffer(encryptedBlob);
    });
}

// Helper function to validate video playability
async function validateVideoPlayability(blob: Blob): Promise<{ isValid: boolean; error?: string }> {
  try {
    // First check the file size
    if (blob.size < 1024) { // Less than 1KB
      return { isValid: false, error: 'File too small to be a valid video' };
    }

    // Get more header bytes for thorough format detection
    const headerBytes = await blob.slice(0, 32).arrayBuffer();
    const header = new Uint8Array(headerBytes);
    
    // Log the full header for debugging
    console.log('Validating header:', {
      hex: Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '),
      ascii: Array.from(header).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('')
    });
    
    // Use the existing detectVideoFormat function
    const mimeType = detectVideoFormat(header);
    const isValid = !!mimeType;

    // Log format detection results
    console.log('Format detection:', { mimeType, size: blob.size });

    // Try to load metadata from the blob directly
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(blob);
      
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        resolve({ isValid: false, error: 'Video load timeout' });
      }, 5000); // 5 second timeout
      
      video.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          resolve({ isValid: false, error: 'Invalid video dimensions' });
        } else {
          console.log('Video validated successfully:', {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration
          });
          resolve({ isValid: true });
        }
      };
      
      video.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve({ isValid: false, error: `Video load error: ${video.error?.message || 'Unknown error'}` });
      };
      
      video.src = objectUrl;
      video.preload = 'metadata';
    });
  } catch (err) {
    const error = err as Error;
    return { isValid: false, error: `Validation error: ${error.message}` };
  }
}
