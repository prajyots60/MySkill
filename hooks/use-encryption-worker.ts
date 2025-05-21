'use client';

import { useState, useEffect, useRef } from 'react';

type EncryptionOperation = 'encrypt' | 'decrypt' | 'generateKey';

interface WorkerMessage {
  status: 'success' | 'error';
  result?: any;
  error?: string;
  operation: EncryptionOperation;
}

/**
 * Hook for using the encryption web worker
 * This provides non-blocking encryption/decryption operations
 */
export function useEncryptionWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<EncryptionOperation, { resolve: Function, reject: Function }>>(new Map());

  // Initialize worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Create the worker
    if (!workerRef.current) {
      try {
        // Create a blob URL for the worker script
        workerRef.current = new Worker(
          new URL('../workers/encryption-worker.ts', import.meta.url), 
          { type: 'module' }
        );

        // Set up message handler
        workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { status, result, error, operation } = event.data;
          
          // Get the saved callback
          const callbacks = callbacksRef.current.get(operation);
          if (callbacks) {
            if (status === 'success') {
              callbacks.resolve(result);
            } else {
              callbacks.reject(new Error(error));
            }
            callbacksRef.current.delete(operation);
          }
          
          // Clear processing state if no more callbacks
          if (callbacksRef.current.size === 0) {
            setIsProcessing(false);
            setProgress(0);
          }
        };
        
        // Handle worker errors
        workerRef.current.onerror = (event) => {
          console.error('Encryption Worker Error:', event);
          
          // Reject all pending promises
          callbacksRef.current.forEach(({ reject }) => {
            reject(new Error('Encryption worker failed'));
          });
          
          // Reset state
          callbacksRef.current.clear();
          setIsProcessing(false);
          setProgress(0);
        };
      } catch (error) {
        console.error('Failed to initialize encryption worker:', error);
      }
    }
    
    // Cleanup
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Generate a new encryption key
  const generateKey = async (): Promise<{ key: string; iv: string }> => {
    if (!workerRef.current) {
      throw new Error('Encryption worker not available');
    }
    
    setIsProcessing(true);
    setProgress(50);
    
    return new Promise((resolve, reject) => {
      const operation: EncryptionOperation = 'generateKey';
      callbacksRef.current.set(operation, { resolve, reject });
      
      workerRef.current!.postMessage({
        operation,
        data: {}
      });
    });
  };

  // Encrypt file using web worker
  const encryptFile = async (
    file: File, 
    key: string, 
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    if (!workerRef.current) {
      throw new Error('Encryption worker not available');
    }
    
    setIsProcessing(true);
    
    // Read file as ArrayBuffer
    const fileBuffer = await readFileAsArrayBuffer(file, (progress) => {
      setProgress(progress * 0.3); // 0-30% for reading
      onProgress?.(progress * 0.3);
    });
    
    setProgress(30);
    onProgress?.(30);
    
    // Process encryption in worker
    return new Promise((resolve, reject) => {
      const operation: EncryptionOperation = 'encrypt';
      callbacksRef.current.set(operation, { 
        resolve: (result: ArrayBuffer) => {
          setProgress(100);
          onProgress?.(100);
          
          // Create a new blob with the encrypted data
          const blob = new Blob([result], { type: file.type });
          resolve(blob);
        }, 
        reject 
      });
      
      // Post message to worker
      workerRef.current!.postMessage({
        operation,
        data: { fileBuffer, key }
      });
      
      setProgress(50);
      onProgress?.(50);
    });
  };

  // Decrypt file using web worker
  const decryptFile = async (
    encryptedFile: File,
    key: string,
    originalType: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    if (!workerRef.current) {
      throw new Error('Encryption worker not available');
    }
    
    setIsProcessing(true);
    
    // Read file as ArrayBuffer
    const fileBuffer = await readFileAsArrayBuffer(encryptedFile, (progress) => {
      setProgress(progress * 0.3); // 0-30% for reading
      onProgress?.(progress * 0.3);
    });
    
    setProgress(30);
    onProgress?.(30);
    
    // Process decryption in worker
    return new Promise((resolve, reject) => {
      const operation: EncryptionOperation = 'decrypt';
      callbacksRef.current.set(operation, { 
        resolve: (result: ArrayBuffer) => {
          setProgress(100);
          onProgress?.(100);
          
          // Create a new blob with the decrypted data
          const blob = new Blob([result], { type: originalType });
          resolve(blob);
        }, 
        reject 
      });
      
      // Post message to worker
      workerRef.current!.postMessage({
        operation,
        data: { fileBuffer, key }
      });
      
      setProgress(50);
      onProgress?.(50);
    });
  };

  // Helper function to read a file as ArrayBuffer with progress
  const readFileAsArrayBuffer = async (
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      
      // Track progress if supported
      if (onProgress) {
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        };
      }
      
      reader.readAsArrayBuffer(file);
    });
  };

  // Utility to detect if web workers are supported
  const isSupported = () => {
    return typeof Worker !== 'undefined';
  };

  return {
    isProcessing,
    progress,
    isSupported,
    generateKey,
    encryptFile,
    decryptFile
  };
}
