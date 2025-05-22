'use client';

import React, { useEffect, useRef, useState } from 'react';
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

export default function VideoJsWasabiPlayer({
  fileUrl,
  title,
  isEncrypted = false,
  encryptionKey,
  posterUrl,
  autoplay = false,
  className = '',
  onProgress,
  onEnded
}: VideoJsWasabiPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and configure VideoJS player
  useEffect(() => {
    // Clean up previous player instance
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    // Load and decrypt video if needed
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading video with params:', { 
          fileUrl, 
          isEncrypted, 
          encryptionKey: encryptionKey ? `${encryptionKey.substring(0, 4)}...${encryptionKey.substring(encryptionKey.length - 4)}` : null 
        });

        // Check if fileUrl is valid
        if (!fileUrl) {
          throw new Error('No video URL provided');
        }

        if (isEncrypted && encryptionKey) {
          console.log('------- VIDEO PLAYER DEBUG INFO -------');
          console.log('Fetching encrypted video from:', fileUrl);
          console.log('Video URL type:', typeof fileUrl);
          console.log('Video URL length:', fileUrl ? fileUrl.length : 0);
          console.log('Encryption key provided:', !!encryptionKey);
          console.log('Encryption key length:', encryptionKey ? encryptionKey.length : 0);
          console.log('Environment variables:', {
            useSampleVideo: process.env.NEXT_PUBLIC_USE_SAMPLE_VIDEO,
          });
          console.log('-------------------------------------');
          
          // For encrypted videos, fetch and decrypt
          try {
            // Add a timestamp to bypass cache if needed
            const urlWithTimestamp = fileUrl.includes('?') 
              ? `${fileUrl}&_t=${Date.now()}` 
              : `${fileUrl}?_t=${Date.now()}`;
            
            console.log('Fetching with cache-busting URL:', urlWithTimestamp);
            
            // Use a sample video for testing if the environment variable is set
            if (process.env.NEXT_PUBLIC_USE_SAMPLE_VIDEO === 'true') {
              console.log('USING SAMPLE VIDEO FOR TESTING');
              const sampleVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
              console.log('Sample video URL:', sampleVideoUrl);
              setVideoUrl(sampleVideoUrl);
              setLoading(false);
              return;
            }
            
            // Check if the URL is a presigned URL (contains a signature)
            const isPresignedUrl = fileUrl.includes('X-Amz-Signature=') || fileUrl.includes('Signature=');
            console.log('URL appears to be presigned:', isPresignedUrl);
            
            // If we're using a presigned URL, validate it
            if (isPresignedUrl) {
              try {
                // Validate the URL format
                const urlObj = new URL(fileUrl);
                console.log('Presigned URL validation passed, hostname:', urlObj.hostname);
                
                // Check if the URL has the expected structure
                if (!urlObj.hostname.includes('wasabisys.com')) {
                  console.warn('Warning: URL hostname does not contain wasabisys.com:', urlObj.hostname);
                }
              } catch (urlError) {
                console.error('Invalid URL format:', urlError);
                throw new Error(`Invalid presigned URL format: ${fileUrl.substring(0, 100)}...`);
              }
            }
            
            // Try to fetch the video
            console.log('Attempting to fetch video from:', urlWithTimestamp);
            
            // Add a timeout to the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            try {
              const response = await fetch(urlWithTimestamp, {
                signal: controller.signal,
                // Add headers that might be needed for CORS
                headers: {
                  'Origin': window.location.origin,
                }
              });
              
              // Clear the timeout
              clearTimeout(timeoutId);
              
              console.log('Fetch response status:', response.status, response.statusText);
              console.log('Response headers:', [...response.headers.entries()]);
              
              // Check for specific error status codes
              if (response.status === 403) {
                throw new Error('Access forbidden: You do not have permission to access this file. This may be due to incorrect Wasabi bucket permissions or CORS settings.');
              } else if (response.status === 404) {
                throw new Error('File not found: The requested video file does not exist in the storage bucket.');
              } else if (response.status === 400) {
                throw new Error('Bad request: The presigned URL may be malformed or expired. Please refresh the page to generate a new URL.');
              } else if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
              }
              
              // Check content type to ensure it's a video
              const contentType = response.headers.get('content-type');
              if (contentType && !contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
                console.warn(`Unexpected content type: ${contentType}. Expected a video format.`);
              }
            } catch (fetchError: unknown) {
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                throw new Error('Request timed out: The video request took too long to complete. This may indicate network issues or that the file is too large.');
              }
              throw fetchError;
            }
            
            // At this point, we know the response was successful
            // We need to fetch the blob again since the response is now out of scope
            const videoResponse = await fetch(urlWithTimestamp);
            const encryptedBlob = await videoResponse.blob();
            console.log('Encrypted blob size:', encryptedBlob.size, 'bytes, type:', encryptedBlob.type);
            
            // Try without .encrypted extension if the file is not found or empty
            if (encryptedBlob.size === 0 && fileUrl.endsWith('.encrypted')) {
              console.log('Empty blob received, trying without .encrypted extension');
              const plainUrl = fileUrl.replace('.encrypted', '');
              const plainResponse = await fetch(plainUrl);
              
              if (plainResponse.ok) {
                const plainBlob = await plainResponse.blob();
                console.log('Plain blob size:', plainBlob.size, 'bytes, type:', plainBlob.type);
                
                if (plainBlob.size > 0) {
                  console.log('Using non-encrypted file directly');
                  const objectUrl = URL.createObjectURL(plainBlob);
                  setVideoUrl(objectUrl);
                  setLoading(false);
                  
                  // Initialize player after a short delay
                  setTimeout(() => {
                    if (videoRef.current) {
                      initializePlayer();
                    }
                  }, 100);
                  return;
                }
              }
            }
            
            if (encryptedBlob.size === 0) {
              throw new Error('Received empty file from server. This may indicate a permission issue or that the file does not exist.');
            }
            
            console.log('Decrypting blob with key:', encryptionKey);
            const decryptedBlob = await decryptFile(encryptedBlob, encryptionKey);
            console.log('Decryption successful, blob size:', decryptedBlob.size);
            const objectUrl = URL.createObjectURL(decryptedBlob);
            setVideoUrl(objectUrl);
          } catch (fetchError) {
            console.error('Error during fetch/decrypt:', fetchError);
            throw fetchError;
          }
        } else {
          // For non-encrypted videos, use URL directly
          console.log('Using non-encrypted URL directly:', fileUrl);
          setVideoUrl(fileUrl);
        }
        
        setLoading(false);
        
        // Initialize player after a short delay to ensure DOM is ready
        setTimeout(() => {
          if (videoRef.current) {
            initializePlayer();
          }
        }, 100);
      } catch (err) {
        console.error('Error loading video:', err);
        setError(`Failed to load video: ${err instanceof Error ? err.message : String(err)}`);
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
  }, [fileUrl, isEncrypted, encryptionKey]);

  // Initialize the Video.js player
  const initializePlayer = () => {
    if (!videoRef.current || !videoUrl) return;

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered');
    videoRef.current.appendChild(videoElement);

    const player = videojs(videoElement, {
      autoplay: autoplay,
      controls: true,
      responsive: true,
      fluid: true,
      preload: 'auto',
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      poster: posterUrl,
      sources: [{
        src: videoUrl,
        type: 'video/mp4'
      }],
      html5: {
        vhs: {
          overrideNative: true
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false
      }
    }, () => {
      console.log('Player is ready');
      
      // Add security measures
      applySecurityMeasures(player);

      // Add event listeners for progress tracking
      if (onProgress) {
        player.on('timeupdate', () => {
          const duration = player.duration() || 0;
          const currentTime = player.currentTime() || 0;
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
    });

    playerRef.current = player;
  };

  // Apply security measures to prevent downloading and unauthorized access
  const applySecurityMeasures = (player: Player) => {
    // Disable right-click menu
    const playerElement = player.el();
    playerElement.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
      return false;
    });

    // Add watermark with user info if needed
    // player.watermark({ ... });

    // Disable keyboard shortcuts that could be used to download
    player.on('keydown', (e: KeyboardEvent) => {
      // Prevent Ctrl+S, Ctrl+U, F12, etc.
      if ((e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85)) || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
    });

    // Add custom error handling
    player.on('error', () => {
      console.error('Video playback error');
    });
  };

  // Clean up the player when component unmounts
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

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
    <div className={`video-container ${className}`}>
      <div ref={videoRef} className="video-js-container" />
      <style jsx>{`
        .video-container {
          position: relative;
          width: 100%;
          height: 100%;
          aspect-ratio: 16/9;
        }
        .video-js-container {
          width: 100%;
          height: 100%;
        }
        :global(.video-js) {
          width: 100%;
          height: 100%;
        }
      `}</style>
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
        
        console.log('Decrypting file with key:', keyString);
        console.log('File size:', encryptedBlob.size, 'bytes');
        console.log('File type:', encryptedBlob.type);
        
        // Get the data as ArrayBuffer
        const data = event.target.result as ArrayBuffer;
        
        // For debugging
        const dataView = new DataView(data);
        const firstBytes = [];
        for (let i = 0; i < Math.min(16, data.byteLength); i++) {
          firstBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
        }
        console.log('First bytes:', firstBytes.join(' '));
        
        // If the file is too small, it might not be encrypted
        if (data.byteLength < 32) {
          console.warn('File is too small to be encrypted, returning as-is');
          resolve(encryptedBlob);
          return;
        }
        
        // Try multiple decryption approaches
        const decryptionApproaches = [
          // Approach 1: Standard AES-CBC with IV in first 16 bytes
          async () => {
            console.log('Trying decryption approach 1: IV in first 16 bytes');
            const iv = new Uint8Array(data.slice(0, 16));
            const encryptedData = data.slice(16);
            
            console.log('IV bytes:', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '));
            
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
            return await window.crypto.subtle.decrypt(
              {
                name: 'AES-CBC',
                iv
              },
              cryptoKey,
              encryptedData
            );
          },
          
          // Approach 2: AES-CBC with zero IV
          async () => {
            console.log('Trying decryption approach 2: Zero IV');
            const iv = new Uint8Array(16); // All zeros
            
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
            
            // Decrypt the entire file
            return await window.crypto.subtle.decrypt(
              {
                name: 'AES-CBC',
                iv
              },
              cryptoKey,
              data
            );
          },
          
          // Approach 3: AES-CTR mode with nonce in first 16 bytes
          async () => {
            console.log('Trying decryption approach 3: AES-CTR with nonce in first 16 bytes');
            const counter = new Uint8Array(data.slice(0, 16));
            const encryptedData = data.slice(16);
            
            // Convert the hex key string to bytes
            const keyBytes = new Uint8Array(keyString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            
            // Import the key
            const cryptoKey = await window.crypto.subtle.importKey(
              'raw',
              keyBytes,
              { name: 'AES-CTR' },
              false,
              ['decrypt']
            );
            
            // Decrypt the data
            return await window.crypto.subtle.decrypt(
              {
                name: 'AES-CTR',
                counter,
                length: 128
              },
              cryptoKey,
              encryptedData
            );
          },
          
          // Approach 4: AES-GCM mode
          async () => {
            console.log('Trying decryption approach 4: AES-GCM');
            const iv = new Uint8Array(data.slice(0, 12)); // GCM typically uses 12 bytes
            const encryptedData = data.slice(12);
            
            // Convert the hex key string to bytes
            const keyBytes = new Uint8Array(keyString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            
            // Import the key
            const cryptoKey = await window.crypto.subtle.importKey(
              'raw',
              keyBytes,
              { name: 'AES-GCM' },
              false,
              ['decrypt']
            );
            
            // Decrypt the data
            return await window.crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv
              },
              cryptoKey,
              encryptedData
            );
          }
        ];
        
        // Try each approach until one works
        let lastError = null;
        for (let i = 0; i < decryptionApproaches.length; i++) {
          try {
            const decryptedData = await decryptionApproaches[i]();
            console.log(`Decryption approach ${i + 1} succeeded!`);
            
            // Check if the decrypted data looks like a valid video file
            const header = new Uint8Array(decryptedData, 0, Math.min(16, decryptedData.byteLength));
            console.log('Decrypted header:', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
            
            // Create a new Blob with the decrypted data
            const decryptedBlob = new Blob([decryptedData], { type: 'video/mp4' });
            console.log('Decryption successful, blob size:', decryptedBlob.size, 'bytes');
            resolve(decryptedBlob);
            return;
          } catch (err) {
            console.error(`Decryption approach ${i + 1} failed:`, err);
            lastError = err;
          }
        }
        
        // If we get here, all approaches failed
        throw lastError || new Error('All decryption approaches failed');
      } catch (error) {
        console.error('Decryption error:', error);
        reject(new Error('Failed to decrypt video. Please check encryption key or contact support.'));
      }
    };
    reader.onerror = (event) => {
      console.error('FileReader error:', event);
      reject(new Error('Failed to read encrypted file'));
    };
    reader.readAsArrayBuffer(encryptedBlob);
  });
}
