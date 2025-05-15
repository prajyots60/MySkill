import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { decodeVideoId } from "@/lib/utils/video-security"

export async function GET(request: Request) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ message: "Token is required" }, { status: 400 })
    }

    // Decode the token to get the video ID
    const videoId = decodeVideoId(token)

    if (!videoId) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 403 })
    }

    console.log("Serving secure player for video ID:", videoId)

    // Get the origin for postMessage security
    const origin = request.headers.get("origin") || new URL(request.url).origin

    // Create a simplified secure HTML page with YouTube embed
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="robots" content="noindex">
        <title>Secure Video Player</title>
        
        <!-- Plyr CSS -->
        <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
        
        <style>
          html, body { 
            margin: 0; 
            padding: 0; 
            width: 100%; 
            height: 100%; 
            overflow: hidden;
            background-color: #000;
          }
          
          .plyr {
            height: 100%;
            width: 100%;
          }
          
          /* Hide YouTube branding */
          .ytp-chrome-top,
          .ytp-chrome-bottom,
          .ytp-watermark,
          .ytp-youtube-button,
          .ytp-title-channel,
          .ytp-title-text {
            display: none !important;
          }
          
          /* Remove default Plyr play button to avoid duplication */
          .plyr--youtube .plyr__control--overlaid {
            display: none !important;
          }
          
          /* Hide iframe interactions */
          .plyr__video-wrapper iframe {
            pointer-events: none !important;
          }
        </style>
      </head>
      <body>
        <div id="player" data-plyr-provider="youtube" data-plyr-embed-id="${videoId}"></div>
        
        <!-- Plyr JS -->
        <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
        
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              const player = new Plyr('#player', {
                controls: [
                  'play-large',
                  'play',
                  'rewind',
                  'fast-forward',
                  'progress',
                  'current-time',
                  'duration',
                  'mute',
                  'volume',
                  'settings'
                ],
                settings: ['speed'],
                speed: {
                  selected: 1,
                  options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
                },
                seekTime: 10,
                youtube: {
                  noCookie: true,
                  rel: 0,
                  showinfo: 0,
                  iv_load_policy: 3,
                  modestbranding: 1,
                  playsinline: 1,
                  disablekb: 1,
                  controls: 0,
                  origin: window.location.origin,
                  enablejsapi: 1,
                  fs: 0,
                  cc_load_policy: 0,
                  hl: 'en'
                },
                fullscreen: { 
                  enabled: false,
                  fallback: false,
                  iosNative: false,
                },
                keyboard: {
                  focused: true,
                  global: false
                },
                tooltips: {
                  controls: true,
                  seek: true
                },
                listeners: {
                  seek: true,
                  speed: true
                }
              });

              // Remove YouTube elements
              const removeYouTubeElements = () => {
                const iframe = document.querySelector('iframe');
                if (iframe) {
                  iframe.style.pointerEvents = 'none';
                }
              };

              player.on('ready', removeYouTubeElements);
              player.on('play', removeYouTubeElements);
              player.on('pause', removeYouTubeElements);

              // Prevent context menu
              document.addEventListener('contextmenu', e => e.preventDefault());

              // Add event listeners for speed changes and seeking
              player.on('ready', () => {
                // Initialize with default speed
                window.parent.postMessage({ 
                  event: 'playerReady',
                  speed: player.speed
                }, window.location.origin);
              });

              player.on('ratechange', () => {
                // Send speed change events to parent
                window.parent.postMessage({ 
                  event: 'speedChange',
                  speed: player.speed
                }, window.location.origin);
              });

              player.on('seeking', () => {
                // Send seeking events to parent
                window.parent.postMessage({ 
                  event: 'seeking',
                  currentTime: player.currentTime
                }, window.location.origin);
              });

              // Add keyboard shortcuts
              document.addEventListener('keydown', (e) => {
                if (e.target instanceof HTMLInputElement) return;
                
                switch(e.key.toLowerCase()) {
                  case 'arrowleft':
                    player.rewind();
                    break;
                  case 'arrowright':
                    player.forward();
                    break;
                  case '[':
                    decreaseSpeed();
                    break;
                  case ']':
                    increaseSpeed();
                    break;
                }
              });

              // Helper functions for speed control
              function decreaseSpeed() {
                const currentSpeed = player.speed;
                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentIndex = speeds.indexOf(currentSpeed);
                if (currentIndex > 0) {
                  player.speed = speeds[currentIndex - 1];
                }
              }

              function increaseSpeed() {
                const currentSpeed = player.speed;
                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentIndex = speeds.indexOf(currentSpeed);
                if (currentIndex < speeds.length - 1) {
                  player.speed = speeds[currentIndex + 1];
                }
              }
            } catch (error) {
              console.error('Error initializing player:', error);
            }
          });
        </script>
      </body>
      </html>
    `

    // Return the HTML with appropriate headers
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    console.error("Error accessing secure video:", error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to access video",
      },
      { status: 500 },
    )
  }
}
