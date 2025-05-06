/**
 * Performance monitoring utilities to track and optimize application performance
 */

// Performance metrics
type PerformanceMetrics = {
  // Core Web Vitals
  fcp: number | null // First Contentful Paint
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  ttfb: number | null // Time to First Byte

  // Custom metrics
  apiLatency: Record<string, number[]> // API response times
  renderTimes: Record<string, number[]> // Component render times
  resourceLoadTimes: Record<string, number[]> // Resource load times
  memoryUsage: number[] // Memory usage samples
  videoMetrics: {
    loadTime: number | null
    bufferingTime: number | null
    latency: number | null
    quality: string | null
    bandwidth: number | null
  }
}

// Initialize metrics
const metrics: PerformanceMetrics = {
  fcp: null,
  lcp: null,
  fid: null,
  cls: null,
  ttfb: null,
  apiLatency: {},
  renderTimes: {},
  resourceLoadTimes: {},
  memoryUsage: [],
  videoMetrics: {
    loadTime: null,
    bufferingTime: null,
    latency: null,
    quality: null,
    bandwidth: null,
  },
}

// Configuration for performance monitoring
export const PERFORMANCE_MONITORING_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === "true",
  sampleRate: 0.1, // Only collect from 10% of sessions
  batchSize: 50,
  batchTimeout: 30000, // 30 seconds
  minSendInterval: 60000, // 1 minute
  // Add storage configuration
  storage: {
    type: process.env.PERFORMANCE_MONITORING_STORAGE || "memory", // 'memory' | 'file' | 'db'
    // Only enable DB storage if explicitly configured
    useDatabase: process.env.PERFORMANCE_MONITORING_STORAGE === "db",
  },
}

// Should we collect metrics for this session?
const shouldCollectMetrics =
  typeof window !== "undefined" &&
  PERFORMANCE_MONITORING_CONFIG.enabled &&
  Math.random() < PERFORMANCE_MONITORING_CONFIG.sampleRate

// Add batching configuration
const BATCH_SIZE = 50 // Number of metrics to batch before sending
const BATCH_TIMEOUT = 30000 // Maximum time to wait before sending a batch (30 seconds)
const MIN_SEND_INTERVAL = 60000 // Minimum time between sends (1 minute)

// Add metrics batching
let metricsBatch: PerformanceMetrics = {
  fcp: null,
  lcp: null,
  fid: null,
  cls: null,
  ttfb: null,
  apiLatency: {},
  renderTimes: {},
  resourceLoadTimes: {},
  memoryUsage: [],
  videoMetrics: {
    loadTime: null,
    bufferingTime: null,
    latency: null,
    quality: null,
    bandwidth: null,
  },
}

let batchCount = 0
let lastSendTime = 0
let batchTimeout: NodeJS.Timeout | null = null

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === "undefined" || !shouldCollectMetrics) return

  try {
    // Track Core Web Vitals using Performance Observer API
    if ("PerformanceObserver" in window) {
      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        if (entries.length > 0) {
          const fcp = entries[0] as PerformanceEntry
          metrics.fcp = fcp.startTime
          console.log(`[Performance] FCP: ${metrics.fcp.toFixed(2)}ms`)
        }
      })
      fcpObserver.observe({ type: "paint", buffered: true })

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        // We take the latest LCP value
        const lcp = entries[entries.length - 1] as PerformanceEntry
        metrics.lcp = lcp.startTime
        console.log(`[Performance] LCP: ${metrics.lcp.toFixed(2)}ms`)
      })
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true })

      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        if (entries.length > 0) {
          const firstInput = entries[0] as any
          metrics.fid = firstInput.processingStart - firstInput.startTime
          console.log(`[Performance] FID: ${metrics.fid.toFixed(2)}ms`)
        }
      })
      fidObserver.observe({ type: "first-input", buffered: true })

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((entryList) => {
        let clsValue = 0
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        metrics.cls = clsValue
        console.log(`[Performance] CLS: ${metrics.cls.toFixed(3)}`)
      })
      clsObserver.observe({ type: "layout-shift", buffered: true })

      // Resource timing for TTFB and resource loading
      const resourceObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()

        for (const entry of entries) {
          const resource = entry as PerformanceResourceTiming

          // Track TTFB for navigation
          if (entry.entryType === "navigation") {
            metrics.ttfb =
              (entry as PerformanceNavigationTiming).responseStart - (entry as PerformanceNavigationTiming).requestStart
            console.log(`[Performance] TTFB: ${metrics.ttfb.toFixed(2)}ms`)
          }

          // Track resource load times
          if (entry.entryType === "resource") {
            const url = new URL(resource.name)
            const path = url.pathname

            // Group by resource type
            const fileExt = path.split(".").pop() || "unknown"
            const category = resource.initiatorType || fileExt

            if (!metrics.resourceLoadTimes[category]) {
              metrics.resourceLoadTimes[category] = []
            }

            const loadTime = resource.responseEnd - resource.startTime
            metrics.resourceLoadTimes[category].push(loadTime)
          }
        }
      })
      resourceObserver.observe({ type: "resource", buffered: true })
      resourceObserver.observe({ type: "navigation", buffered: true })
    }

    // Track memory usage periodically
    if (performance && (performance as any).memory) {
      const trackMemory = () => {
        const memory = (performance as any).memory
        if (memory) {
          metrics.memoryUsage.push(memory.usedJSHeapSize / (1024 * 1024)) // MB
        }
      }

      // Track every 10 seconds
      trackMemory()
      setInterval(trackMemory, 10000)
    }

    // Send metrics on page unload
    window.addEventListener("beforeunload", () => {
      sendMetricsToServer()
    })

    // Also send metrics periodically
    setInterval(() => {
      sendMetricsToServer()
    }, 60000) // Every minute
  } catch (error) {
    console.error("Error initializing performance monitoring:", error)
  }
}

/**
 * Track API request latency
 */
export function trackApiLatency(endpoint: string, startTime: number) {
  if (!shouldCollectMetrics) return

  const endTime = performance.now()
  const latency = endTime - startTime

  if (!metrics.apiLatency[endpoint]) {
    metrics.apiLatency[endpoint] = []
  }

  metrics.apiLatency[endpoint].push(latency)

  // Log slow requests (over 500ms)
  if (latency > 500) {
    console.warn(`[Performance] Slow API request to ${endpoint}: ${latency.toFixed(2)}ms`)
  }
}

/**
 * Track component render time
 */
export function trackRenderTime(componentName: string, renderTime: number) {
  if (!shouldCollectMetrics) return

  if (!metrics.renderTimes[componentName]) {
    metrics.renderTimes[componentName] = []
  }

  metrics.renderTimes[componentName].push(renderTime)

  // Log slow renders (over 50ms)
  if (renderTime > 50) {
    console.warn(`[Performance] Slow render for ${componentName}: ${renderTime.toFixed(2)}ms`)
  }
}

/**
 * Send collected metrics to server with batching
 */
function sendMetricsToServer() {
  if (!shouldCollectMetrics) return

  const currentTime = Date.now()

  // Check if we should send based on time interval
  if (currentTime - lastSendTime < PERFORMANCE_MONITORING_CONFIG.minSendInterval) {
    return
  }

  // Only send if we have some meaningful data
  if (metricsBatch.fcp || metricsBatch.lcp || Object.keys(metricsBatch.apiLatency).length > 0) {
    // If DB storage is disabled, just log to console in development
    if (!PERFORMANCE_MONITORING_CONFIG.storage.useDatabase) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Performance Metrics]", metricsBatch)
      }
      return
    }

    // Use sendBeacon for reliable delivery even during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", JSON.stringify(metricsBatch))
    } else {
      // Fallback to fetch
      fetch("/api/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metricsBatch),
        keepalive: true,
      }).catch((err) => console.error("Failed to send metrics:", err))
    }

    // Reset metrics after sending
    metricsBatch = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      apiLatency: {},
      renderTimes: {},
      resourceLoadTimes: {},
      memoryUsage: [],
      videoMetrics: {
        loadTime: null,
        bufferingTime: null,
        latency: null,
        quality: null,
        bandwidth: null,
      },
    }
    batchCount = 0
    lastSendTime = currentTime
  }
}

/**
 * Hook to measure component render time
 */
export function useRenderTimeTracking(componentName: string) {
  if (typeof window === "undefined" || !shouldCollectMetrics) return { startRender: () => {}, endRender: () => {} }

  return {
    startRender: () => performance.now(),
    endRender: (startTime: number) => {
      const renderTime = performance.now() - startTime
      trackRenderTime(componentName, renderTime)
    },
  }
}

/**
 * Track video performance metrics with batching
 */
export function trackVideoPerformance(videoMetrics: {
  loadTime?: number
  bufferingTime?: number
  latency?: number
  quality?: string
  bandwidth?: number
}) {
  if (!shouldCollectMetrics) return

  // Update batch metrics
  if (videoMetrics.loadTime) {
    metricsBatch.videoMetrics.loadTime = videoMetrics.loadTime
  }
  if (videoMetrics.bufferingTime) {
    metricsBatch.videoMetrics.bufferingTime = videoMetrics.bufferingTime
  }
  if (videoMetrics.latency) {
    metricsBatch.videoMetrics.latency = videoMetrics.latency
  }
  if (videoMetrics.quality) {
    metricsBatch.videoMetrics.quality = videoMetrics.quality
  }
  if (videoMetrics.bandwidth) {
    metricsBatch.videoMetrics.bandwidth = videoMetrics.bandwidth
  }

  batchCount++

  // Clear any existing timeout
  if (batchTimeout) {
    clearTimeout(batchTimeout)
  }

  // Set new timeout for batch sending
  batchTimeout = setTimeout(() => {
    sendMetricsToServer()
  }, BATCH_TIMEOUT)

  // Send if batch size reached
  if (batchCount >= BATCH_SIZE) {
    sendMetricsToServer()
  }

  // Log performance issues
  if (videoMetrics.latency && videoMetrics.latency > 5000) {
    console.warn(`[Performance] High video latency detected: ${videoMetrics.latency}ms`)
  }
  if (videoMetrics.bufferingTime && videoMetrics.bufferingTime > 2000) {
    console.warn(`[Performance] Excessive buffering detected: ${videoMetrics.bufferingTime}ms`)
  }
}

// Initialize monitoring
if (typeof window !== "undefined") {
  initPerformanceMonitoring()
}
