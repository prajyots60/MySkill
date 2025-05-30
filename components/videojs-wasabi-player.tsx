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
  encryptionIV?: string;  // Add IV prop to receive directly from parent
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
    // For AES-GCM, we standardize on 256-bit keys (64 hex chars) 
    // but still accept 128-bit keys (32 hex chars) for backward compatibility
    validLength: key.length === 64 || key.length === 32,
    nonHexChars: key.match(/[^0-9a-fA-F]/g),
    preferred: key.length === 64 // 256-bit keys are preferred
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
      error: `Invalid encryption key length: expected 64 hex characters (256-bit key), got ${key.length}` 
    };
  }

  if (!keyValidation.preferred) {
    console.warn('Using 128-bit key for AES-GCM; 256-bit keys are recommended for best security');
  }

  return { isValid: true };
}

export default function VideoJsWasabiPlayer({
  fileUrl,
  title,
  isEncrypted = false,
  encryptionKey,
  encryptionIV,
  className = ''
}: VideoJsWasabiPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const decryptedBlobRef = useRef<{ sourceUrl: string | null, url: string | null, blob: Blob | null }>({ sourceUrl: null, url: null, blob: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const playerInitializedRef = useRef(false);

  // Handle cleanup of videoplayer and blob URLs
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
  }, []);

  // Player initialization function
  const initializePlayer = useCallback((url: string) => {
    try {
      if (!videoRef.current || !mountedRef.current) {
        console.error('Video element not found or component unmounted');
        return;
      }

      // Create video element only once
      if (videoRef.current.firstChild) {
        console.log('Video container already has children, reusing existing container');
      } else {
        // Create the video element
        const videoElement = document.createElement('video');
        videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered';
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('controls', '');
        videoElement.id = 'video-js-player-' + Date.now();
        
        // Advanced security attributes
        videoElement.setAttribute('disablePictureInPicture', 'true');
        videoElement.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
        videoElement.setAttribute('oncontextmenu', 'return false;');
        
        // Apply security styles
        Object.assign(videoElement.style, {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          pointerEvents: 'auto', // Enable pointer events
          WebkitTapHighlightColor: 'transparent',
          cursor: 'pointer'
        });
        
        videoRef.current.appendChild(videoElement);
      }

      // Determine MIME type with security checks
      let sourceType = 'video/mp4';
      if (url.includes('.webm')) sourceType = 'video/webm';
      if (url.includes('.mov')) sourceType = 'video/quicktime';
      if (url.includes('.m3u8')) sourceType = 'application/x-mpegURL';
      
      // Enhanced security options
      const playerOptions = {
        controls: true,
        fluid: true,
        preload: 'auto',
        playsinline: true,
        crossOrigin: 'anonymous',
        html5: {
          vhs: {
            overrideNative: true,
            enableLowInitialPlaylist: true,
            handleManifestRedirects: true,
            useDevicePixelRatio: true,
          },
          loadingSpinnerDelay: 100 // Short delay before showing spinner
        },
        userActions: {
          hotkeys: {
            enableNumbers: false,
            enableVolumeScroll: false,
            enableMute: false,
            enableFullscreen: false
          },
          doubleClick: false, // Disable double click to prevent conflicts
          click: true // Enable single click
        },
        controlBar: {
          children: [
            'playToggle',
            'volumePanel',
            'currentTimeDisplay',
            'timeDivider',
            'durationDisplay',
            'progressControl',
            'playbackRateMenuButton',
            'fullscreenToggle',
          ],
          volumePanel: {
            inline: false,
            volumeControl: {
              vertical: true,
              volumeBar: {
                vertical: true
              }
            }
          }
        },
        inactivityTimeout: 3000, // Hide controls after 3 seconds of inactivity
        // Advanced security features
        liveui: false,
        responsive: true,
        suppressNotSupportedError: true,
        sources: [{
          src: url,
          type: sourceType
        }],
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        errorDisplay: false,
        loadingSpinner: {
          display: loading
        },
        bigPlayButton: true,
        textTrackSettings: false,
        resizeManager: false,
        poster: '', // Prevent poster frame downloads
        controlBarVisibility: 'transform'
      };

      const videoElement = videoRef.current.querySelector('video');
      if (!videoElement) {
        throw new Error('Video element not found in container');
      }

      // Advanced security measures for video element
      videoElement.addEventListener('contextmenu', e => e.preventDefault(), true);
      videoElement.addEventListener('keydown', e => {
        const blockedKeys = ['s', 'p', 'g', 'u', 'i', 'c', 'j', 'F12'];
        if (
          (e.ctrlKey && blockedKeys.includes(e.key.toLowerCase())) ||
          (e.shiftKey && blockedKeys.includes(e.key.toLowerCase())) ||
          (e.altKey && blockedKeys.includes(e.key.toLowerCase())) ||
          e.key === 'F12'
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);

      // Anti-tampering measures
      let lastChecksum = '';
      const verifyPlayerIntegrity = () => {
        const elementText = videoElement.outerHTML;
        const checksum = elementText.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        if (lastChecksum && lastChecksum !== String(checksum)) {
          // Player has been modified
          videoElement.pause();
          videoElement.currentTime = 0;
          videoElement.src = '';
        }
        lastChecksum = String(checksum);
      };
      setInterval(verifyPlayerIntegrity, 1000);

      // Create player instance with enhanced security
      const player = videojs(videoElement, playerOptions, function onPlayerReady() {
        console.log('Player is ready');
        playerInitializedRef.current = true;

        // Set loading to false when player is ready
        if (mountedRef.current) {
          setLoading(false);
        }

        // Listen for time updates to show progress
        this.on('timeupdate', () => {
          const currentTime = Math.floor(this.currentTime() || 0);
          const duration = Math.floor(this.duration() || 0);
          if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            
            // Update progress bar styles
            const progressBar = document.querySelector('.video-progress-bar') as HTMLElement;
            if (progressBar) {
              progressBar.style.width = `${progress}%`;
            }

            // Update duration display
            const durationDisplay = document.querySelector('.video-duration-display');
            if (durationDisplay) {
              const formatTime = (time: number) => {
                const minutes = Math.floor(time / 60);
                const seconds = Math.floor(time % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              };
              
              durationDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            }
          }
        });

        // Also listen for various ready states
        this.on(['loadeddata', 'loadedmetadata', 'canplay'], () => {
          if (mountedRef.current) {
            setLoading(false);
          }
        });

        // Improved click event handler on the video element
        const tech = this.tech();
        if (tech && tech.el_) {
          tech.el_.style.pointerEvents = 'auto';
          tech.el_.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.paused()) {
              this.play();
            } else {
              this.pause();
            }
          }, { capture: true });
        }

        // Enable control bar interactions with proper event propagation
        const controlBar = this.getChild('ControlBar');
        if (controlBar && controlBar.el_) {
          // Ensure control bar is clickable
          controlBar.el_.style.pointerEvents = 'auto';
          
          // Handle control bar clicks without interfering with video clicks
          controlBar.on('click', (e: MouseEvent) => {
            e.stopPropagation();
          });

          // Make sure all child controls are clickable
          const childComponents = Object.values(controlBar.children_);
          childComponents.forEach((control: any) => {
            if (control && control.el_) {
              control.el_.style.pointerEvents = 'auto';
            }
          });
        }

        // Specifically handle play toggle button
        const playToggle = this.getChild('ControlBar')?.getChild('PlayToggle');
        if (playToggle && playToggle.el_) {
          playToggle.el_.style.pointerEvents = 'auto';
          playToggle.on('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (this.paused()) {
              this.play();
            } else {
              this.pause();
            }
          });
        }

        // Secure the player instance
        this.on('loadstart', () => {
          const tech = this.tech_;
          if (tech && tech.el_) {
            // Protect source URL
            const secureUrl = new URL(url);
            secureUrl.searchParams.forEach((_, key) => {
              secureUrl.searchParams.set(key, '***');
            });
            
            Object.defineProperty(tech.el_, 'currentSrc', {
              get: () => secureUrl.toString(),
              configurable: false
            });
          }
        });

        // Add keyboard controls with restrictions
        this.on('keydown', (e: KeyboardEvent) => {
          const currentTime = this.currentTime();
          const duration = this.duration();
          
          if (typeof currentTime === 'number' && typeof duration === 'number') {
            if (e.code === 'ArrowRight') {
              this.currentTime(Math.min(currentTime + 10, duration));
            } else if (e.code === 'ArrowLeft') {
              this.currentTime(Math.max(0, currentTime - 10));
            }
          }
          // Block other keyboard events
          e.stopPropagation();
        });

        // Block screen capture API if available
        if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
          try {
            Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
              value: async () => {
                throw new Error('Screen capture is blocked');
              },
              configurable: false
            });
          } catch (e) {
            console.warn('Failed to block screen capture API:', e);
          }
        }
      });

      // Additional security measures
      player.on('error', () => {
        const error = player.error();
        console.error('Video.js error:', error);
        
        if (error && error.code === 4) {
          console.log('Attempting to recover from media error...');
          player.src({ src: url, type: sourceType });
          player.load();
          
          setTimeout(() => {
            if (mountedRef.current && player.error()) {
              setError('Video playback error. Please try again.');
            }
          }, 3000);
        } else if (mountedRef.current) {
          setError(`Video error: ${error?.message || 'Unknown error'}`);
        }
      });

      // Advanced stream protection
      player.on('sourceset', () => {
        const tech = player.tech();
        if (tech) {
          // Add visibility protection
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              player.pause();
            }
          });
        }
      });

      // Remove native controls and enforce custom ones
      player.usingNativeControls(false);
      playerRef.current = player;
      videoElement.controls = false;
      
      // Add comprehensive security styles
      const securityStyle = document.createElement('style');
      securityStyle.textContent = `
        .video-js {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          pointer-events: auto !important;
          transform: translateZ(0);
          isolation: isolate;
        }
        
        .video-js.vjs-has-started .vjs-loading-spinner,
        .video-js.vjs-playing .vjs-loading-spinner,
        .video-js.vjs-paused .vjs-loading-spinner {
          display: none !important;
          opacity: 0 !important;
        }

        .video-js .vjs-loading-spinner {
          display: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .video-js.vjs-waiting .vjs-loading-spinner {
          display: block;
          opacity: 1;
        }
        .video-js .vjs-tech {
          pointer-events: auto !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          -webkit-mask-image: -webkit-radial-gradient(white, black);
          -webkit-backface-visibility: hidden;
          -moz-backface-visibility: hidden;
          backface-visibility: hidden;
          cursor: pointer !important;
        }
        .video-js * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          pointer-events: none;
        }
        .video-js .vjs-control-bar {
          pointer-events: auto !important;
          background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7)) !important;
          backdrop-filter: blur(10px) !important;
        }
        .video-js .vjs-control {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .video-js .vjs-progress-control {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .video-js .vjs-progress-holder {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .video-js .vjs-play-progress {
          pointer-events: none !important;
        }
        .video-js .vjs-menu-button {
          pointer-events: auto !important;
        }
        .vjs-tech::-webkit-media-controls,
        .vjs-tech::-webkit-media-controls-panel,
        .vjs-tech::-webkit-media-controls-panel-container,
        .vjs-tech::-webkit-media-controls-start-playback-button,
        .vjs-tech::-webkit-media-controls-enclosure,
        video::-webkit-media-controls-overlay-enclosure,
        video::-webkit-media-controls-enclosure,
        video::-webkit-media-controls,
        video::-webkit-media-controls-panel,
        video::-webkit-media-controls-panel-container,
        video::-webkit-media-controls-start-playback-button,
        video::-webkit-media-controls-timeline,
        video::-webkit-media-controls-current-time-display,
        video::-webkit-media-controls-time-remaining-display,
        video::-webkit-media-controls-time-remaining-display,
        video::-webkit-media-controls-mute-button,
        video::-webkit-media-controls-toggle-closed-captions-button,
        video::-webkit-media-controls-volume-slider,
        video::-webkit-media-controls-fullscreen-button,
        video::-internal-media-controls-download-button,
        video::-internal-media-controls-overflow-button {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
        }
        video::-webkit-media-controls-enclosure {
          display: none !important;
          opacity: 0 !important;
        }
        video::-webkit-media-controls {
          display: none !important;
          opacity: 0 !important;
        }
        .vjs-text-track-display {
          pointer-events: none !important;
        }
        .video-js *::selection {
          background: transparent !important;
        }
        .video-js *::-moz-selection {
          background: transparent !important;
        }

        /* Hide loading spinner when video is ready */
        .video-js.vjs-has-started .vjs-loading-spinner,
        .video-js.vjs-playing .vjs-loading-spinner,
        .video-js.vjs-paused .vjs-loading-spinner {
          display: none !important;
          opacity: 0 !important;
        }

        /* Only show loading spinner during actual loading states */
        .video-js .vjs-loading-spinner {
          display: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .video-js.vjs-waiting .vjs-loading-spinner {
          display: block;
          opacity: 1;
        }
      `;
      document.head.appendChild(securityStyle);

      // Add custom styles
      const styles = `
      .video-js .vjs-tech {
        pointer-events: auto !important;
        user-select: none !important;
        cursor: pointer !important;
      }

      .video-js .vjs-control-bar {
        pointer-events: auto !important;
        user-select: none !important;
      }

      .video-js .vjs-control {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .video-js .vjs-progress-control {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .video-js .vjs-progress-holder {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .video-js .vjs-play-progress {
        pointer-events: none !important;
      }

      .video-js .vjs-slider {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .video-js .vjs-volume-panel {
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      `;

      // Create and append style element
      const styleSheet = document.createElement('style');
      styleSheet.type = 'text/css';
      styleSheet.innerText = styles;
      document.head.appendChild(styleSheet);

      // Block DevTools opening
      window.addEventListener('keydown', function(e) {
        if (
          (e.key === 'F12') ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.ctrlKey && e.key === 'U')
        ) {
          e.preventDefault();
        }
      });

    } catch (err) {
      console.error('Error initializing player:', err);
      if (mountedRef.current) {
        setError('Failed to initialize video player');
        setLoading(false);
      }
    }
  }, []);

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
          
          // If encryptionIV is provided directly from props, use that
          let metadataIV: string | undefined = encryptionIV || undefined;
          
          // If no IV is provided via prop, try to fetch it from metadata
          if (!metadataIV) {
            console.log('No encryptionIV provided via props, will attempt to fetch from metadata');
            
            // Extract lectureId from fileUrl if possible (optional) - moved outside try block to make it available in scope
            const urlMatch = fileUrl.match(/lectures\/([a-zA-Z0-9-]+)/);
            const lectureId = urlMatch ? urlMatch[1] : null;
            
            try {
              if (lectureId) {
                const metadataResponse = await fetch(`/api/lectures/${lectureId}/wasabi-metadata`);
                if (metadataResponse.ok) {
                  const metadata = await metadataResponse.json();
                  
                  // Let's dump the actual response structure for debugging
                  console.log('Raw metadata response structure:', JSON.stringify(metadata, null, 2));
                  
                  // Check the top-level encryptionIV field first (new consistent location)
                  metadataIV = metadata.encryptionIV;
                  
                  // If not found, try the encryptionInfo location
                  if (!metadataIV) {
                    metadataIV = metadata.encryptionInfo?.encryptionIV;
                  }
                  
                  // Check for IV in all possible locations in the metadata structure
                  if (!metadataIV) {
                    // Check in secureMetadata directly
                    if (metadata.secureMetadata?.encryptionIV) {
                      metadataIV = metadata.secureMetadata.encryptionIV;
                    }
                    // Check in lecture.videoMetadata.secureMetadata
                    else if (metadata.lecture?.videoMetadata?.secureMetadata?.encryptionIV) {
                      metadataIV = metadata.lecture.videoMetadata.secureMetadata.encryptionIV;
                    }
                    // Check in lecture.videoMetadata directly (in case it's structured differently)
                    else if (metadata.lecture?.videoMetadata) {
                      try {
                        const videoMeta = metadata.lecture.videoMetadata;
                        
                        // Handle both primitive and object types
                        if (typeof videoMeta === 'object' && videoMeta !== null) {
                          // Direct properties
                          metadataIV = videoMeta.encryptionIV || videoMeta.secureMetadata?.encryptionIV;
                          
                          // Try to parse string metadata if needed
                          if (!metadataIV && typeof videoMeta === 'string') {
                            try {
                              const parsedMeta = JSON.parse(videoMeta);
                              metadataIV = parsedMeta.encryptionIV || parsedMeta.secureMetadata?.encryptionIV;
                            } catch (e) {
                              console.log('Failed to parse videoMetadata as JSON string');
                            }
                          }
                        }
                      } catch (err) {
                        console.error('Error trying to extract IV from videoMetadata:', err);
                      }
                    }
                  }
                  
                  // Add detailed diagnostic logging for the IV search
                  const diagnostics = {
                    ivSource: encryptionIV ? 'props' : 'metadata',
                    ivFound: !!metadataIV,
                    ivLength: metadataIV?.length,
                    ivSample: metadataIV ? metadataIV.substring(0, 6) + '...' : 'MISSING',
                    searchLocations: {
                      topLevel: !!metadata.encryptionIV,
                      encryptionInfo: !!metadata.encryptionInfo?.encryptionIV,
                      secureMetadata: !!metadata.secureMetadata?.encryptionIV,
                      lectureVideoMetadata: !!metadata.lecture?.videoMetadata?.secureMetadata?.encryptionIV
                    },
                    // Include sample of metadata structure for debugging
                    metadataKeys: Object.keys(metadata),
                    lecture: metadata.lecture ? {
                      id: metadata.lecture.id,
                      hasVideoMetadata: !!metadata.lecture.videoMetadata
                    } : null
                  };
                  
                  console.log('Metadata IV search results:', diagnostics);
                  
                  if (!metadataIV) {
                    console.error('Failed to find IV in metadata response', diagnostics);
                  }
                }
              }
            } catch (metadataError) {
              // Only throw if we don't have an IV from props
              if (!encryptionIV) {
                console.error('Failed to fetch metadata IV - decryption cannot proceed without IV:', metadataError);
                throw new Error('Failed to fetch required encryption IV from metadata');
              }
            }
          } else if (encryptionIV) {
            console.log('Using encryptionIV provided via props:', {
              ivLength: encryptionIV.length, 
              ivSample: encryptionIV.substring(0, 6) + '...'
            });
          } else {
            console.log('No IV provided in props, but this should never happen as we checked earlier');
          }
          
          // After all attempts, if the IV is still not found, throw a more detailed error
          if (!metadataIV) {
            console.error('No IV found in props or metadata', {
              hasPropsIV: !!encryptionIV,
              fileUrl
            });
            throw new Error('No IV provided in props or metadata. Cannot decrypt video without initialization vector.');
          }
          
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status}`);
          }
          
          const encryptedBlob = await response.blob();
          console.log('Decrypting video...', { 
            size: encryptedBlob.size,
            hasMetadataIV: !!metadataIV,
            ivLength: metadataIV?.length,
            ivFirstChars: metadataIV?.substring(0, 8)
          });
          let decryptedBlob = await decryptFile(encryptedBlob, encryptionKey, metadataIV);
          
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
  }, [fileUrl, isEncrypted, encryptionKey, encryptionIV, handleInitializePlayer, cleanup]); // Stable dependencies

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

// Helper function to normalize encryption key - standardized for AES-GCM 256-bit keys
function normalizeEncryptionKey(key: string): Uint8Array {
  // For AES-GCM, we always use a 256-bit key (32 bytes)
  const targetKeyLength = 32; // 256 bits
  let bytes: Uint8Array;
  
  console.log('Normalizing encryption key:', {
    length: key.length,
    format: key.length === 64 && /^[0-9a-fA-F]+$/.test(key) 
      ? 'Standard 256-bit hex' 
      : 'Non-standard format'
  });
  
  try {
    // Standard format: 64 hex characters representing a 256-bit key
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      bytes = new Uint8Array(targetKeyLength);
      for (let i = 0; i < targetKeyLength; i++) {
        bytes[i] = parseInt(key.substr(i * 2, 2), 16);
      }
      console.log('Parsed standard 256-bit hex key');
      
      return bytes; // Return early for the standard case
    }
    
    // For non-standard cases, try to adapt:
    
    // Case 1: Other hex string (of any length)
    if (/^[0-9a-fA-F]+$/.test(key)) {
      // Ensure we have an even number of hex chars
      const normalizedHex = key.length % 2 === 0 ? key : '0' + key;
      const byteLength = normalizedHex.length / 2;
      
      // Create initial byte array
      const initialBytes = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) {
        initialBytes[i] = parseInt(normalizedHex.substr(i * 2, 2), 16);
      }
      
      // Ensure it's exactly 32 bytes
      bytes = new Uint8Array(targetKeyLength);
      
      // If original is shorter, repeat it. If longer, truncate it.
      for (let i = 0; i < targetKeyLength; i++) {
        bytes[i] = initialBytes[i % byteLength];
      }
      
      console.log('Adapted non-standard hex key to 256 bits');
    } 
    // Case 2: Raw string - convert to fixed-length bytes
    else {
      // Hash the string to get consistent output size
      console.log('Converting string to hash-derived key');
      
      // Use a simple hashing approach to get consistent key
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      
      // Simple deterministic key derivation (this is not secure, but ensures consistency)
      bytes = new Uint8Array(targetKeyLength);
      let acc = 0;
      
      for (let i = 0; i < targetKeyLength; i++) {
        // Mix in position and previous values to distribute entropy
        acc = ((acc << 5) - acc + (i * 65537)) & 0xFFFFFFFF;
        
        for (let j = 0; j < data.length; j++) {
          acc = ((acc << 5) - acc + data[j]) & 0xFFFFFFFF;
        }
        
        bytes[i] = acc % 256;
      }
      
      console.log('Created 256-bit key from string input');
    }
    
    // Verify final key length
    if (bytes.length !== targetKeyLength) {
      throw new Error(`Key normalization failed: incorrect output length ${bytes.length}`);
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

// Helper function to decrypt a file using standardized AES-GCM with 12-byte IV from metadata
function decryptFile(encryptedBlob: Blob, keyString: string, metadataIV?: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read encrypted file');
          }
          
          let data = event.target.result as ArrayBuffer;
          
          if (data.byteLength < 1) {
            throw new Error('File is too small to be a valid encrypted video');
          }

          console.log('Decrypting video...', { 
            size: encryptedBlob.size, 
            hasMetadataIV: !!metadataIV 
          });

          // Convert hex key to bytes - specifically for 256-bit AES-GCM key
          let keyBytes: Uint8Array;
          try {
            if (/^[0-9a-fA-F]+$/.test(keyString) && keyString.length === 64) {
              // Handle standard 256-bit hex key (64 hex characters)
              keyBytes = new Uint8Array(32);
              for (let i = 0; i < 32; i++) {
                keyBytes[i] = parseInt(keyString.substr(i * 2, 2), 16);
              }
            } else {
              // Fallback to the normalize function for non-standard keys
              keyBytes = normalizeEncryptionKey(keyString);
            }
          } catch (keyError) {
            console.error('Key normalization error:', keyError);
            throw new Error(`Invalid encryption key: ${keyError instanceof Error ? keyError.message : 'Could not process key'}`);
          }
          
          console.log('Using encryption key:', {
            originalLength: keyString.length,
            normalizedLength: keyBytes.length,
            keyBits: keyBytes.length * 8
          });

          // Use IV from metadata, it should no longer be prepended to file
          if (!metadataIV) {
            throw new Error('No IV provided in metadata. Cannot proceed with decryption.');
          }

          // Validate the IV format - should be 24 hex chars (12 bytes)
          if (!/^[0-9a-fA-F]{24}$/.test(metadataIV)) {
            console.error('Invalid IV format:', metadataIV);
            throw new Error(`Invalid IV format: expected 24 hex chars, got ${metadataIV.length} chars. IV: ${metadataIV.substring(0, 10)}...`);
          }

          // Convert hex IV from metadata to bytes
          const iv = new Uint8Array(12);
          try {
            for (let i = 0; i < 12; i++) {
              iv[i] = parseInt(metadataIV.substr(i * 2, 2), 16);
            }
            console.log('Using IV from metadata:', {
              ivHex: metadataIV,
              ivBytes: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' ')
            });
          } catch (ivParseError) {
            console.error('Failed to parse IV from metadata:', ivParseError);
            throw new Error(`Failed to parse IV from metadata: ${metadataIV.substring(0, 10)}... is not valid hex`);
          }
          
          console.log('Decryption parameters:', {
            algorithm: 'AES-GCM',
            ivLength: iv.length,
            ivHex: metadataIV,
            ivSource: 'metadata'
          });

          // Verify IV content - should not be all zeros or a pattern
          const isIVAllZeros = iv.every(b => b === 0);
          if (isIVAllZeros) {
            console.warn('Warning: IV contains all zeros, which is insecure for AES-GCM');
          }

          // Check the first few bytes of the data and compare with the IV
          const header = new Uint8Array(data.slice(0, 16));
          console.log('Data header:', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
          
          // Compare the first 12 bytes of data with the IV
          const firstTwelveBytes = new Uint8Array(data.slice(0, 12));
          const matchesIV = Array.from(firstTwelveBytes).every((byte, index) => byte === iv[index]);
          
          if (matchesIV) {
            console.warn('IMPORTANT: First 12 bytes of data match the IV - this indicates the IV might be prepended to the encrypted data');
            // However, we'll still use the IV from metadata as that's more reliable
          }
          
          console.log('Using complete data with IV from metadata/props');
          
          let decryptedData: ArrayBuffer;
          let format: string;
          
          // Import the key for AES-GCM - we standardize on 256-bit keys for AES-GCM
          try {
            // Check if data appears to already contain the IV - this could explain the decryption failures
            // First 12 bytes matching the IV would indicate the IV is prepended to the data
            const firstBytes = new Uint8Array(data.slice(0, 12));
            const ivArray = Array.from(iv);
            const firstBytesArray = Array.from(firstBytes);
            
            const isPossiblyPrepended = firstBytesArray.every((byte, index) => byte === ivArray[index]);
            if (isPossiblyPrepended) {
              console.warn('DETECTED POSSIBLE PREPENDED IV! First 12 bytes of data match IV:', {
                ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
                firstBytesHex: Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join('')
              });
              // In this case, we need to skip the first 12 bytes when decrypting
              data = data.slice(12);
              console.log('Adjusted data for decryption, removing prepended IV. New data length:', data.byteLength);
            }
            
            // Import the key for AES-GCM - we standardize on 256-bit keys for AES-GCM
            const cryptoKey = await window.crypto.subtle.importKey(
              'raw', 
              keyBytes, 
              { 
                name: 'AES-GCM',
                length: keyBytes.length * 8 // Use actual key length (256 or 128 bits)
              }, 
              false, 
              ['decrypt']
            );
            
            // Simple validation - IV must be exactly 12 bytes for AES-GCM
            if (iv.length !== 12) {
              throw new Error(`Invalid IV length: expected 12 bytes for AES-GCM, got ${iv.length}`);
            }
            
            // Key must be 32 bytes (256 bits) or 16 bytes (128 bits)
            if (keyBytes.length !== 32 && keyBytes.length !== 16) {
              throw new Error(`Invalid key length: expected 32 bytes (256 bits) or 16 bytes (128 bits) for AES-GCM, got ${keyBytes.length}`);
            }
            
            // Log detailed decryption parameters
            console.log('Decryption attempt with parameters:', {
              algorithm: 'AES-GCM',
              ivLength: iv.length,
              keyBits: keyBytes.length * 8,
              dataLength: data.byteLength
            });
            
            // Check if data might have authentication tag included
            // AES-GCM tag is typically 16 bytes (128 bits)
            const possibleAuthTagIncluded = data.byteLength > 16 && 
              (data.byteLength % 16 === 0 || (data.byteLength - 12) % 16 === 0);
              
            if (possibleAuthTagIncluded) {
              console.log('Data size suggests possible authentication tag inclusion - this is normal for AES-GCM');
            }
            
            // Simple direct decryption with the provided IV
            console.log('Starting decryption with provided IV...', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '));
            
            // Always use the provided IV and decrypt the full data
            decryptedData = await window.crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv,
                tagLength: 128
              },
              cryptoKey,
              data // Use the full data without any slicing
            );
            
            console.log('AES-GCM decryption successful!');
          } catch (error) {
            console.error('AES-GCM decryption failed:', error);
            
            // Add clear diagnostic information
            console.error('Decryption failed. Diagnostic information:', {
              ivLength: iv.length,
              dataLength: data.byteLength,
              keyLength: keyBytes.length * 8 + ' bits',
              ivHex: metadataIV,
              ivBytes: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '),
              errorName: error instanceof Error ? error.name : 'Unknown',
              errorMessage: error instanceof Error ? error.message : String(error),
              dataHeader: Array.from(new Uint8Array(data.slice(0, 16))).map(b => b.toString(16).padStart(2, '0')).join(' ')
            });
            
            // Try again with a slightly different approach if it's specifically an OperationError
            if (error instanceof Error && error.name === 'OperationError') {
              console.log('Detected OperationError - trying alternative approach with CBC mode...');
              
              try {
                // Try with AES-CBC as fallback (this requires handling padding)
                const cbcKey = await window.crypto.subtle.importKey(
                  'raw',
                  keyBytes,
                  {
                    name: 'AES-CBC',
                    length: keyBytes.length * 8
                  },
                  false,
                  ['decrypt']
                );
                
                // Use the first 16 bytes of the IV or pad it if needed
                let cbcIv;
                if (iv.length === 16) {
                  cbcIv = iv;
                } else {
                  cbcIv = new Uint8Array(16);
                  // Copy the original IV bytes and pad with zeros
                  cbcIv.set(iv);
                }
                
                console.log('Attempting AES-CBC decryption with IV:', 
                  Array.from(cbcIv).map(b => b.toString(16).padStart(2, '0')).join(' '));
                
                decryptedData = await window.crypto.subtle.decrypt(
                  {
                    name: 'AES-CBC',
                    iv: cbcIv
                  },
                  cbcKey,
                  data
                );
                console.log('AES-CBC decryption successful!');
                return;
              } catch (cbcError) {
                console.error('AES-CBC fallback also failed:', cbcError);
              }
            }
            
            // Provide clear error message
            if (error instanceof Error) {
              throw new Error(`AES-GCM decryption failed: ${error.message}`);
            } else {
              throw new Error('AES-GCM decryption failed: Unknown error');
            }
          }
          
          // Log the first bytes of the decrypted data for debugging
          const decryptedHeaderBytes = new Uint8Array(decryptedData.slice(0, 32));
          console.log('Decrypted header:', Array.from(decryptedHeaderBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
          
          // Check for MP4 signature in the first 32 bytes (ftyp)
          const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // "ftyp"
          let hasFtyp = false;
          
          // Fix: headerBytes was undefined, create it from decryptedHeaderBytes
          const headerBytes = decryptedHeaderBytes;
          
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

// Simple helper function for logging purposes
function logIVInfo(iv: Uint8Array, label: string) {
  console.log(`${label} IV:`, Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(' '));
}
