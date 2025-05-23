'use client';

import { useEffect, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface WasabiVideoPlayerProps {
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

export default function WasabiVideoPlayer({
  fileUrl,
  title,
  isEncrypted = false,
  encryptionKey,
  posterUrl,
  autoplay = false,
  className = '',
  onProgress,
  onEnded
}: WasabiVideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Function to set up the video player
    const setupPlayer = (url: string) => {
      const videoElement = document.querySelector('.wasabi-player') as HTMLVideoElement;
      if (videoElement) {
        playerRef[1](videoElement);
        
        // Initialize Plyr
        const player = new Plyr(videoElement, {
          captions: { active: true, update: true },
          fullscreen: { enabled: true },
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          storage: { enabled: true, key: 'wasabi-player' },
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'mute',
            'volume',
            'captions',
            'settings',
            'pip',
            'airplay',
            'fullscreen'
          ]
        });

        // Add event listeners for progress tracking
        if (onProgress) {
          player.on('timeupdate', () => {
            const duration = player.duration || 0;
            const currentTime = player.currentTime || 0;
            if (duration > 0) {
              const progress = Math.floor((currentTime / duration) * 100);
              onProgress(progress);
            }
          });
        }

        // Add event listener for video completion
        if (onEnded) {
          player.on('ended', () => {
            onEnded();
          });
        }

        // Clean up Plyr instance when component unmounts
        return () => {
          player.destroy();
        };
      }
    };

    // Function to load and decrypt the video if necessary
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isEncrypted && encryptionKey) {
          // For encrypted videos, we need to fetch and decrypt
          const response = await fetch(fileUrl);
          const encryptedBlob = await response.blob();
          const decryptedBlob = await decryptFile(encryptedBlob, encryptionKey);
          const objectUrl = URL.createObjectURL(decryptedBlob);
          setVideoUrl(objectUrl);
        } else {
          // For non-encrypted videos, just use the URL directly
          setVideoUrl(fileUrl);
        }
        
        setLoading(false);
        
        // Initialize player after a short delay to ensure DOM is ready
        setTimeout(() => {
          setupPlayer(fileUrl);
        }, 100);
      } catch (err) {
        console.error('Error loading video:', err);
        setError('Failed to load video. Please try again later.');
        setLoading(false);
      }
    };

    loadVideo();

    // Clean up object URL when component unmounts
    return () => {
      if (videoUrl && isEncrypted) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [fileUrl, isEncrypted, encryptionKey, onProgress, onEnded]);

  if (loading) {
    return (
      <div className={`flex justify-center items-center bg-black aspect-video ${className}`}>
        <div className="loader"></div>
        <style jsx>{`
          .loader {
            border: 5px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            border-top: 5px solid white;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex justify-center items-center bg-black text-white aspect-video ${className}`}>
        <div className="text-center p-4">
          <p className="text-red-500 mb-2">⚠️ Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <video
        className="wasabi-player"
        controls
        crossOrigin="anonymous"
        playsInline
        poster={posterUrl}
        autoPlay={autoplay}
      >
        <source src={videoUrl || ''} type="video/mp4" />
        <p>
          Your browser doesn't support HTML video. Here is a{' '}
          <a href={videoUrl || ''}>link to the video</a> instead.
        </p>
      </video>
    </div>
  );
}

// Helper function to decrypt a file with multi-algorithm support (AES-GCM preferred, AES-CBC as fallback)
async function decryptFile(encryptedBlob: Blob, keyString: string): Promise<Blob> {
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

        // Convert the hex key string to bytes (must be 32 bytes for AES-256)
        const keyBytes = new Uint8Array(32);
        const hexKey = keyString.padEnd(64, '0').slice(0, 64);
        for (let i = 0; i < 32; i++) {
          keyBytes[i] = parseInt(hexKey.substr(i * 2, 2), 16);
        }

        // Extract IV from first 16 bytes
        const iv = new Uint8Array(data.slice(0, 16));
        console.log('IV:', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '));

        let decryptedData: ArrayBuffer;
        
        // Try AES-GCM first (matches API configuration in wasabi-multipart-init)
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
        } catch (gcmError) {
          console.log('AES-GCM decryption failed, trying AES-CBC:', gcmError);
          
          // Fall back to AES-CBC if GCM fails
          // Import the key for AES-CBC
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

          // Decrypt the data with AES-CBC (using full 16-byte IV)
          decryptedData = await window.crypto.subtle.decrypt(
            {
              name: 'AES-CBC',
              iv
            },
            cbcKey,
            data.slice(16) // Skip IV bytes
          );
          
          console.log('AES-CBC decryption successful!');
        }

        // Log the decrypted header for debugging
        const header = new Uint8Array(decryptedData.slice(0, 32));
        console.log('Decrypted header:', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Check for MP4 signature (ftyp)
        const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // "ftyp"
        let hasFtyp = false;
        
        // Look for ftyp signature anywhere in first 32 bytes
        for (let i = 0; i < 16; i++) {
          if (i + 4 < header.length) {
            if (header[i] === ftypSignature[0] && 
                header[i+1] === ftypSignature[1] && 
                header[i+2] === ftypSignature[2] && 
                header[i+3] === ftypSignature[3]) {
              hasFtyp = true;
              console.log('Found MP4 ftyp signature at offset:', i);
              break;
            }
          }
        }
        
        // Create blob with decrypted data and proper MIME type
        const mimeType = hasFtyp ? 'video/mp4' : 'video/mp4';  // Default to mp4 even if no signature found
        resolve(new Blob([decryptedData], { type: mimeType }));

      } catch (error) {
        console.error('Decryption error:', error);
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read encrypted file'));
    reader.readAsArrayBuffer(encryptedBlob);
  });
}

// Helper function to detect video format from header
function detectVideoFormat(header: Uint8Array): string {
  try {
    // First check for MP4 signatures
    const mp4Sigs = ['ftyp', 'moov', 'mdat'];
    const headerStr = String.fromCharCode(...header);
    for (const sig of mp4Sigs) {
      if (headerStr.includes(sig)) {
        return 'video/mp4';
      }
    }

    // Fixed signature lookup for other formats
    if (headerStr.startsWith('RIFF')) return 'video/x-msvideo';  // AVI
    if (headerStr.startsWith('OggS')) return 'video/ogg';        // OGG
    if (headerStr.startsWith('WEBM')) return 'video/webm';       // WebM
    if (headerStr.includes('matroska')) return 'video/x-matroska'; // MKV
    
    return 'video/mp4'; // Default to MP4
  } catch (e) {
    console.warn('Error detecting format:', e);
    return 'video/mp4';
  }
}
