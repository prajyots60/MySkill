'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { NetworkStatus } from './network-status';

interface NetworkContextType {
  isOnline: boolean;
  connectionQuality: 'good' | 'poor' | 'unknown';
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  connectionQuality: 'unknown',
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkStatus, setNetworkStatus] = useState<NetworkContextType>({
    isOnline: true,
    connectionQuality: 'unknown',
  });

  useEffect(() => {
    const checkConnectionQuality = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          const effectiveType = connection.effectiveType;
          const downlink = connection.downlink;

          let quality: 'good' | 'poor' | 'unknown' = 'unknown';
          
          if (effectiveType === '4g' || downlink > 1.5) {
            quality = 'good';
          } else if (effectiveType === '2g' || effectiveType === '3g' || downlink <= 1.5) {
            quality = 'poor';
          }

          setNetworkStatus(prev => ({
            ...prev,
            connectionQuality: quality,
          }));
        }
      }
    };

    const handleOnline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: true }));
      checkConnectionQuality();
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: false }));
    };

    const handleConnectionChange = () => {
      checkConnectionQuality();
    };

    // Set initial states
    setNetworkStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
    checkConnectionQuality();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', handleConnectionChange);
      }
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', handleConnectionChange);
        }
      }
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkStatus}>
      {children}
      <NetworkStatus />
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
