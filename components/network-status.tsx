'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, WifiOff, Wifi, RefreshCw, ActivitySquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetwork } from './network-provider';
import { cn } from "@/lib/utils";

// Add keyframe animation styles
const pulseAnimation = {
  "0%, 100%": { opacity: 1, transform: 'scale(1)' },
  "50%": { opacity: 0.5, transform: 'scale(0.95)' },
};

export function NetworkStatus() {
  const { isOnline, connectionQuality } = useNetwork();
  const [isVisible, setIsVisible] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showMinimal, setShowMinimal] = useState(false);
  const [hasShownConnected, setHasShownConnected] = useState(false);  useEffect(() => {
    if (isOnline && connectionQuality === 'good' && !hasShownConnected) {
      // Show connected message only once
      setIsVisible(true);
      setShowMinimal(false);
      setHasShownConnected(true);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      
      return () => clearTimeout(hideTimer);
    } else if (!isOnline) {
      // Show full offline message
      setIsVisible(true);
      setShowMinimal(false);
      setHasShownConnected(false);
      
      // After 10 seconds, switch to minimal view
      const minimalTimer = setTimeout(() => {
        setShowMinimal(true);
      }, 10000);
      
      return () => clearTimeout(minimalTimer);
    }
  }, [isOnline, connectionQuality, hasShownConnected]);

  const getIcon = () => {
    if (!isOnline) return WifiOff;
    if (isReconnecting) return RefreshCw;
    if (connectionQuality === 'poor') return ActivitySquare;
    return Wifi;
  };

  const getMessage = () => {
    if (!isOnline) return 'No Internet Connection';
    if (isReconnecting) return 'Reconnecting...';
    if (connectionQuality === 'poor') return 'Poor Connection';
    return 'Connected';
  };

  const getColors = () => {
    if (!isOnline) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100';
    if (connectionQuality === 'poor') return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100';
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100';
  };

  const getIconStyles = () => {
    if (!isOnline) {
      return "animate-[pulse_2s_ease-in-out_infinite] text-red-500";
    }
    if (isReconnecting) {
      return "animate-spin text-yellow-500";
    }
    return "";
  };

  if (!isVisible) return null;

  const Icon = getIcon();

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="fixed top-4 right-4 z-50 flex items-center gap-2"
      >
        {isOnline && connectionQuality === 'good' ? (
          // Connected message - shows only once
          <motion.div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${getColors()}`}
            exit={{ opacity: 0 }}
          >
            <Icon className={cn("h-5 w-5", getIconStyles())} />
            <span className="font-medium">Connected</span>
          </motion.div>
        ) : !isOnline ? (
          showMinimal ? (
            // Minimal offline view after 10 seconds
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={`flex items-center gap-2 p-2 rounded-lg shadow-lg ${getColors()}`}
            >
              <Icon className={cn("h-5 w-5", getIconStyles())} />
              <button
                onClick={() => {
                  setIsReconnecting(true);
                  window.location.reload();
                }}
                className="text-sm bg-white/20 rounded-full w-6 h-6 flex items-center justify-center hover:bg-white/30 transition-colors"
                title="Retry connection"
              >
                ↻
              </button>
            </motion.div>
          ) : (
            // Full offline message for first 10 seconds
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${getColors()}`}>
              <Icon className={cn("h-5 w-5", getIconStyles())} />
              <span className="font-medium">No Internet Connection</span>
              <button
                onClick={() => {
                  setIsReconnecting(true);
                  window.location.reload();
                }}
                className="ml-2 px-2 py-1 text-sm bg-white/20 rounded hover:bg-white/30 transition-colors"
              >
                Retry
              </button>
            </div>
          )
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
