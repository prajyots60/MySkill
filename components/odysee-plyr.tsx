"use client";

import { useState, useEffect, useRef } from "react";
import { parseOdyseeUrl, getOdyseeEmbedUrl } from "@/lib/odysee-helpers";
import { getOdyseeDirectUrl } from "@/lib/odysee-direct-url";
// Removed Plyr CSS import as we're using direct iframe approach

interface OdyseePlyrProps {
  url?: string;
  claimId?: string;
  claimName?: string;
  title?: string;
  onEnded?: () => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  autoPlay?: boolean;
  customEndScreen?: boolean;
  className?: string;
}

export function OdyseePlyr({
  url,
  claimId,
  claimName,
  title = "Odysee Video",
  onEnded,
  onReady,
  onError,
  autoPlay = false,
  customEndScreen = true,
  className = "",
}: OdyseePlyrProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    // Function to get the embed URL
    const getEmbedUrl = () => {
      try {
        if (url) {
          const parsedData = parseOdyseeUrl(url);
          if (parsedData) {
            return parsedData.embedUrl;
          }
          throw new Error("Invalid Odysee URL");
        } else if (claimId && claimName) {
          return getOdyseeEmbedUrl(claimName, claimId);
        }
        throw new Error(
          "Either URL or both claimId and claimName must be provided"
        );
      } catch (e) {
        const errorMsg =
          e instanceof Error ? e.message : "Failed to parse Odysee URL";
        setError(errorMsg);
        onError?.(e instanceof Error ? e : new Error(errorMsg));
        return null;
      }
    };

    // Simplified player loader - using direct iframe approach for reliability
    const loadPlayer = async () => {
      try {
        if (!containerRef.current) {
          return;
        }

        // Get the embed URL
        const embedUrl = getEmbedUrl();
        if (!embedUrl) {
          return;
        }

        setIsLoading(true);

        // Create a clean container for the player
        containerRef.current.innerHTML = "";

        // Create a direct iframe for reliability - we'll handle our custom end screen separately
        const iframe = document.createElement("iframe");

        // Add autoplay parameter if needed and other parameters to improve playback and control
        const embedUrlWithParams = `${embedUrl}${
          embedUrl.includes("?") ? "&" : "?"
        }${autoPlay ? "autoplay=1" : ""}&api=true&controls=true`;

        // Configure iframe for proper display
        iframe.src = embedUrlWithParams;
        iframe.allowFullscreen = true;
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.style.position = "absolute";
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.aspectRatio = "16/9"; // Force proper aspect ratio
        iframe.title = title;
        iframe.id = `odysee-player-${Date.now()}`;
        iframe.setAttribute("allowtransparency", "true");
        iframe.setAttribute(
          "sandbox",
          "allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
        );

        // Disable all external navigation from the iframe
        iframe.addEventListener("load", function () {
          try {
            // Check if the player loaded correctly
            setTimeout(() => {
              try {
                // Create smaller invisible overlays just for the logo/branding areas
                const logoBlocker = document.createElement("div");
                logoBlocker.style.position = "absolute";
                logoBlocker.style.top = "0";
                logoBlocker.style.right = "0";
                logoBlocker.style.width = "50px";
                logoBlocker.style.height = "50px";
                logoBlocker.style.zIndex = "3";
                logoBlocker.style.pointerEvents = "auto"; // Block only logo clicks

                const nameBlocker = document.createElement("div");
                nameBlocker.style.position = "absolute";
                nameBlocker.style.top = "0";
                nameBlocker.style.left = "0";
                nameBlocker.style.width = "150px";
                nameBlocker.style.height = "50px";
                nameBlocker.style.zIndex = "3";
                nameBlocker.style.pointerEvents = "auto"; // Block only name clicks

                // Add these specific blockers
                aspectRatioWrapper.appendChild(logoBlocker);
                aspectRatioWrapper.appendChild(nameBlocker);
              } catch (e) {
                // Silent error handling
              }
            }, 1000);
          } catch (e) {
            // Silent error handling
          }
        });

        // Create a wrapper with aspect ratio container to ensure proper display
        const aspectRatioWrapper = document.createElement("div");
        aspectRatioWrapper.className = "aspect-ratio-container";
        aspectRatioWrapper.style.position = "relative";
        aspectRatioWrapper.style.paddingBottom = "56.25%"; // 16:9 aspect ratio
        aspectRatioWrapper.style.height = "0";
        aspectRatioWrapper.style.overflow = "hidden";

        // Add iframe directly to the container
        aspectRatioWrapper.appendChild(iframe);
        containerRef.current.appendChild(aspectRatioWrapper);

        // Store iframe reference
        iframeRef.current = iframe;

        // Add a brand blocker overlay to prevent clicks on the top navigation elements
        const brandBlockers = document.createElement("div");
        brandBlockers.className = "odysee-brand-blockers";
        brandBlockers.style.position = "absolute";
        brandBlockers.style.top = "0";
        brandBlockers.style.left = "0";
        brandBlockers.style.width = "100%";
        brandBlockers.style.height = "60px"; // Block top navigation bar
        brandBlockers.style.zIndex = "2"; // Lower z-index to not interfere with controls
        brandBlockers.style.pointerEvents = "none"; // Don't block interaction with video controls

        // Add specific logo blockers for top right and top left areas
        const topLeftBlock = document.createElement("div");
        topLeftBlock.className = "odysee-topleft-blocker";
        topLeftBlock.style.position = "absolute";
        topLeftBlock.style.top = "0";
        topLeftBlock.style.left = "0";
        topLeftBlock.style.width = "150px";
        topLeftBlock.style.height = "60px";
        topLeftBlock.style.zIndex = "2";
        topLeftBlock.style.pointerEvents = "none"; // Changed to none to allow controls to work

        const topRightBlock = document.createElement("div");
        topRightBlock.className = "odysee-topright-blocker";
        topRightBlock.style.position = "absolute";
        topRightBlock.style.top = "0";
        topRightBlock.style.right = "0";
        topRightBlock.style.width = "150px";
        topRightBlock.style.height = "60px";
        topRightBlock.style.zIndex = "2";
        topRightBlock.style.pointerEvents = "none"; // Changed to none to allow controls to work

        // Add the brand blockers to the container
        containerRef.current.appendChild(brandBlockers);
        containerRef.current.appendChild(topLeftBlock);
        containerRef.current.appendChild(topRightBlock);

        // Add top area click blocker (blocks top 70% of the player)
        const topAreaBlocker = document.createElement("div");
        topAreaBlocker.className = "odysee-top-area-blocker";
        topAreaBlocker.style.position = "absolute";
        topAreaBlocker.style.top = "0";
        topAreaBlocker.style.left = "0";
        topAreaBlocker.style.width = "100%";
        topAreaBlocker.style.height = "70%"; // Block top 70% of the player
        topAreaBlocker.style.zIndex = "5"; // Higher z-index to ensure it blocks clicks
        topAreaBlocker.style.pointerEvents = "auto"; // Block all interaction in this area
        topAreaBlocker.style.background = "transparent"; // Invisible overlay
        topAreaBlocker.title =
          "Click blocker to prevent Odysee embed redirects";

        // Add the top area blocker to the container
        containerRef.current.appendChild(topAreaBlocker);

        // Apply custom CSS to ensure proper display and end screen styling
        const customCSS = `
          .aspect-ratio-container {
            position: relative; 
            padding-bottom: 56.25%;
            height: 0; 
            overflow: hidden;
            max-width: 100%;
            background: #000;
          }
          
          .aspect-ratio-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
          }
          
          .custom-end-screen {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 20; /* Higher z-index to ensure it's above all player elements */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            padding: 2rem;
            animation: fadeIn 0.5s ease-in-out;
            pointer-events: all; /* Ensure buttons are clickable */
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .custom-end-screen h2 {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            font-weight: bold;
          }
          .custom-end-screen p {
            margin-bottom: 2rem;
            opacity: 0.9;
            font-size: 1.1rem;
            max-width: 80%;
            line-height: 1.5;
          }
          .custom-end-screen-buttons {
            display: flex;
            gap: 1.5rem;
          }
          .custom-end-screen-button {
            background: rgba(26, 175, 255, 0.9);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
            font-size: 1rem;
          }
          .custom-end-screen-button:hover {
            background: rgba(26, 175, 255, 1);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
          
          /* Odysee brand blocker styles */
          .odysee-brand-blockers {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            background: transparent;
          }
          .odysee-topleft-blocker,
          .odysee-topright-blocker {
            pointer-events: none;
            background: transparent;
          }
          
          /* Top area click blocker for Odysee player */
          .odysee-top-area-blocker {
            pointer-events: auto;
            background: transparent;
            cursor: default;
          }
        `;

        // Add style element to head
        const styleEl = document.createElement("style");
        styleEl.textContent = customCSS;
        document.head.appendChild(styleEl);

        setIsLoading(false);

        // Store a simple player reference for our custom controls
        playerRef.current = {
          play: () => {
            try {
              if (iframeRef.current) {
                // Send a postMessage to try to play the video
                iframeRef.current.contentWindow?.postMessage(
                  { action: "play" },
                  "*"
                );
                // Also try focusing which might trigger autoplay
                iframeRef.current.focus();
              }
            } catch (e) {
              // Silent error handling
            }
          },
          pause: () => {
            try {
              if (iframeRef.current) {
                // Send a postMessage to try to pause the video
                iframeRef.current.contentWindow?.postMessage(
                  { action: "pause" },
                  "*"
                );
              }
            } catch (e) {
              // Silent error handling
            }
          },
          restart: () => {
            if (iframeRef.current) {
              // Reload the iframe to restart the video
              const currentSrc = iframeRef.current.src;
              iframeRef.current.src = currentSrc;
            }
          },
        };

        // Set up iframe load event
        iframe.onload = () => {
          setIsLoading(false);
          setPlayerReady(true);
          onReady?.();
        };

        // Add message event listener to try to capture video events
        const messageHandler = (event: MessageEvent) => {
          // Try to detect video play/pause events from Odysee
          try {
            if (event.data && typeof event.data === "object") {
              // Check for ended event patterns
              if (
                event.data.event === "ended" ||
                (event.data.info && event.data.info.playerState === "ended")
              ) {
                if (customEndScreen) {
                  setShowEndScreen(true);
                }
                onEnded?.();
              }

              // Update duration if available
              if (
                event.data.duration &&
                !isNaN(event.data.duration) &&
                event.data.duration > 0
              ) {
                setDuration(event.data.duration);
              }
            }
          } catch (e) {
            // Silent error handling
          }
        };

        window.addEventListener("message", messageHandler);

        // Return cleanup function
        return () => {
          window.removeEventListener("message", messageHandler);
        };
      } catch (err) {
        setIsLoading(false);
        setError(
          "Failed to initialize player: " +
            (err instanceof Error ? err.message : String(err))
        );
        onError?.(
          err instanceof Error ? err : new Error("Failed to initialize player")
        );
      }
    };

    // Run the player initialization
    loadPlayer();

    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Silent error handling
        }
        playerRef.current = null;
      }
    };
  }, [
    url,
    claimId,
    claimName,
    title,
    onEnded,
    onError,
    onReady,
    autoPlay,
    customEndScreen,
  ]);

  // Helper functions for custom end screen
  const handleContinue = () => {
    setShowEndScreen(false);
    onEnded?.();
  };

  const handleRestart = () => {
    setShowEndScreen(false);
    if (playerRef.current) {
      playerRef.current.restart();
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="ml-2 text-sm">Loading video...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 z-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-red-500 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-center">Video Error</h3>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            {error}
          </p>
        </div>
      )}

      {/* Custom end screen */}
      {customEndScreen && showEndScreen && (
        <div className="custom-end-screen" style={{ pointerEvents: "auto" }}>
          <h2>Thank You for Watching!</h2>
          <p>
            We hope you enjoyed this video and found it valuable. If you have
            any questions or want to learn more, check out our other resources
            below.
          </p>
          <div className="custom-end-screen-buttons">
            <button
              className="custom-end-screen-button"
              onClick={handleContinue}
            >
              Continue
            </button>
            <button
              className="custom-end-screen-button"
              onClick={handleRestart}
            >
              Watch Again
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full odysee-player plyr-wrapper"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "#000",
          minHeight: "240px", // Ensure minimum height for controls to display properly
        }}
      ></div>
    </div>
  );
}
