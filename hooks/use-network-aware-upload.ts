'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  online: boolean;
  downlink?: number;  // Connection bandwidth in Mbps
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number;       // Round-trip time
  saveData?: boolean; // Data-saving mode active
}

interface NetworkSpeedTest {
  downloadSpeed: number; // in Mbps
  latency: number;       // in ms
  timestamp: number;     // when the test was run
}

// Controls for adaptive uploads
interface AdaptiveConfig {
  maxConcurrentChunks: number;  // Maximum parallel requests
  chunkSize: number;            // Size of each chunk in bytes
  retryLimit: number;           // Max retry attempts per chunk
  retryDelay: number;           // Delay before retry in ms
  adaptiveChunking: boolean;    // Enable dynamic chunk size adjustment
}

export function useNetworkAwareUpload() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });
  const [networkSpeed, setNetworkSpeed] = useState<NetworkSpeedTest | null>(null);
  const [adaptiveConfig, setAdaptiveConfig] = useState<AdaptiveConfig>({
    maxConcurrentChunks: 4,
    chunkSize: 5 * 1024 * 1024, // 5MB default
    retryLimit: 3,
    retryDelay: 1000,
    adaptiveChunking: true,
  });

  // Initialize network information monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Update network status when online/offline events fire
    const handleOnline = () => {
      setNetworkStatus(prev => ({ ...prev, online: true }));
      // When coming back online, do a speed test
      setTimeout(testNetworkSpeed, 1000);
    };
    
    const handleOffline = () => {
      setNetworkStatus(prev => ({ ...prev, online: false }));
    };

    // Monitor connection changes if Network Information API is available
    const updateConnectionInfo = () => {
      // @ts-ignore - Network Information API is not in all TS definitions yet
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        setNetworkStatus({
          online: navigator.onLine,
          downlink: connection.downlink,
          effectiveType: connection.effectiveType,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });

        // Update adaptive config based on network conditions
        updateAdaptiveConfig({
          downlink: connection.downlink,
          effectiveType: connection.effectiveType,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo);
      // Initial update
      updateConnectionInfo();
    } else {
      // If Network Information API is not available, run a speed test
      testNetworkSpeed();
    }

    // Initial online status
    setNetworkStatus(prev => ({ ...prev, online: navigator.onLine }));

    // Clean up event listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, []);

  /**
   * Run a network speed test by downloading a small test file
   */
  const testNetworkSpeed = useCallback(async () => {
    try {
      // Use a small file from the app's public directory
      // The file should be small enough to not impact user experience
      // but large enough to get a meaningful measurement
      const testFileUrl = '/test-file.bin'; // 256KB test file
      const startTime = Date.now();
      
      // Make a request with a cache-busting parameter
      const response = await fetch(`${testFileUrl}?_=${startTime}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Network test failed');
      }

      // Get response time first for latency calculation
      const responseTime = Date.now();
      const latency = responseTime - startTime;
      
      // Then download the file to measure bandwidth
      const blob = await response.blob();
      const endTime = Date.now();
      
      // Calculate download speed in Mbps
      // Size in bits / time in seconds = bits per second
      // Then convert to Mbps
      const downloadTimeMs = endTime - responseTime;
      const fileSizeBits = blob.size * 8;
      const downloadSpeed = fileSizeBits / (downloadTimeMs / 1000) / 1024 / 1024;

      const speedTest = {
        downloadSpeed,
        latency,
        timestamp: endTime,
      };

      setNetworkSpeed(speedTest);

      // Update adaptive config based on measured speed
      updateAdaptiveConfig({
        downlink: downloadSpeed,
        rtt: latency,
      });

      return speedTest;
    } catch (error) {
      console.warn('Network speed test failed:', error);
      return null;
    }
  }, []);

  /**
   * Update adaptive upload configuration based on network conditions
   */
  const updateAdaptiveConfig = useCallback((networkInfo: Partial<NetworkStatus>) => {
    setAdaptiveConfig(prev => {
      const newConfig = { ...prev };
      
      // Determine connection quality
      const { downlink, effectiveType, rtt, saveData } = networkInfo;
      
      // Adjust max concurrent requests based on connection quality
      if (typeof downlink === 'number') {
        if (downlink >= 10) {
          // Fast connection (>= 10 Mbps)
          newConfig.maxConcurrentChunks = 8; 
        } else if (downlink >= 5) {
          // Good connection (>= 5 Mbps)
          newConfig.maxConcurrentChunks = 6;
        } else if (downlink >= 2) {
          // Moderate connection (>= 2 Mbps)
          newConfig.maxConcurrentChunks = 4;
        } else if (downlink >= 0.5) {
          // Slow connection (>= 0.5 Mbps)
          newConfig.maxConcurrentChunks = 2;
        } else {
          // Very slow connection
          newConfig.maxConcurrentChunks = 1;
        }
      } else if (effectiveType) {
        // Fallback to effectiveType if downlink not available
        switch (effectiveType) {
          case '4g':
            newConfig.maxConcurrentChunks = 6;
            break;
          case '3g':
            newConfig.maxConcurrentChunks = 3;
            break;
          case '2g':
            newConfig.maxConcurrentChunks = 2;
            break;
          case 'slow-2g':
            newConfig.maxConcurrentChunks = 1;
            break;
        }
      }
      
      // Adjust chunk size based on connection quality
      if (typeof downlink === 'number' && prev.adaptiveChunking) {
        if (downlink >= 10) {
          // Fast connection (>= 10 Mbps)
          newConfig.chunkSize = 10 * 1024 * 1024; // 10 MB
        } else if (downlink >= 5) {
          // Good connection (>= 5 Mbps)
          newConfig.chunkSize = 5 * 1024 * 1024; // 5 MB
        } else if (downlink >= 2) {
          // Moderate connection (>= 2 Mbps)
          newConfig.chunkSize = 2 * 1024 * 1024; // 2 MB
        } else if (downlink >= 0.5) {
          // Slow connection (>= 0.5 Mbps)
          newConfig.chunkSize = 1 * 1024 * 1024; // 1 MB
        } else {
          // Very slow connection
          newConfig.chunkSize = 512 * 1024; // 512 KB
        }
      }
      
      // If in data saving mode, reduce chunk size
      if (saveData) {
        newConfig.chunkSize = Math.min(newConfig.chunkSize, 1 * 1024 * 1024); // 1 MB max
        newConfig.maxConcurrentChunks = Math.min(newConfig.maxConcurrentChunks, 2); // 2 max
      }
      
      // Adjust retry timing based on RTT
      if (typeof rtt === 'number') {
        // Set retry delay to be at least 2x RTT but not less than 1 second
        // and not more than 10 seconds
        newConfig.retryDelay = Math.max(1000, Math.min(10000, rtt * 2));
      }

      return newConfig;
    });
  }, []);
  
  /**
   * Manually update adaptive configuration settings
   */
  const configureAdaptiveUploads = useCallback((config: Partial<AdaptiveConfig>) => {
    setAdaptiveConfig(prev => ({
      ...prev,
      ...config,
    }));
  }, []);

  /**
   * Get delay recommendation for a specific retry attempt
   * Uses exponential backoff with jitter for better retry behavior
   */
  const getRetryDelay = useCallback((attempt: number): number => {
    // Base delay is the configured retryDelay
    const baseDelay = adaptiveConfig.retryDelay;
    
    // Calculate delay with exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    
    // Add jitter (±30%) to avoid thundering herd problem
    const jitter = exponentialDelay * 0.3 * (Math.random() - 0.5);
    
    // Return the total delay, capped at 30 seconds to prevent excessive waits
    return Math.min(exponentialDelay + jitter, 30000);
  }, [adaptiveConfig.retryDelay]);

  /**
   * Force a manual network speed test
   */
  const runNetworkSpeedTest = useCallback(async () => {
    return await testNetworkSpeed();
  }, [testNetworkSpeed]);

  return {
    networkStatus,
    networkSpeed,
    adaptiveConfig,
    configureAdaptiveUploads,
    getRetryDelay,
    runNetworkSpeedTest,
  };
}
