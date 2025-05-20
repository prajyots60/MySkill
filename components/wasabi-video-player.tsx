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

// Helper function to decrypt a file
async function decryptFile(encryptedBlob: Blob, keyString: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!event.target?.result) {
          throw new Error('Failed to read file');
        }
        
        // Get the data as ArrayBuffer
        const data = event.target.result as ArrayBuffer;
        
        // Extract IV (first 16 bytes) and encrypted data
        const iv = new Uint8Array(data.slice(0, 16));
        const encryptedData = data.slice(16);
        
        // Convert the hex key string to bytes
        const keyBytes = new Uint8Array(keyString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        
        // Import the key
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-CBC' },
          false,
          ['decrypt']
        );
        
        // Decrypt the data
        const decryptedData = await window.crypto.subtle.decrypt(
          {
            name: 'AES-CBC',
            iv
          },
          cryptoKey,
          encryptedData
        );
        
        // Create a new Blob with the decrypted data
        resolve(new Blob([decryptedData], { type: encryptedBlob.type }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(encryptedBlob);
  });
}
