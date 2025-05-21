'use client';

import { useState, useCallback } from 'react';

// Enhanced encryption worker with authenticated encryption (AES-GCM)
// and improved performance for large files

// Interfaces
interface EncryptionProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentComplete: number;
}

interface EncryptionResult {
  success: boolean;
  data?: Blob;
  encryptionKey?: string;
  metadata?: {
    algorithm: string;
    keyLength: number;
    iv: string;
  };
  error?: string;
}

// Use a larger key size for stronger encryption (256-bit)
const KEY_LENGTH = 256;
// Use AES-GCM for authenticated encryption
const ALGORITHM = 'AES-GCM';
// Size of chunks for processing large files
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks

export function useEnhancedEncryption() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<EncryptionProgress>({
    bytesProcessed: 0,
    totalBytes: 0,
    percentComplete: 0,
  });

  /**
   * Generate a secure random encryption key
   */
  const generateKey = useCallback(async (): Promise<{
    key: string;
    algorithm: string;
  }> => {
    // Generate a cryptographically secure key
    const key = await window.crypto.subtle.generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    // Export the key to raw format
    const exportedKey = await window.crypto.subtle.exportKey('raw', key);
    
    // Convert to hex string for storage
    const keyBytes = new Uint8Array(exportedKey);
    const keyHex = Array.from(keyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      key: keyHex,
      algorithm: ALGORITHM,
    };
  }, []);

  /**
   * Encrypt a file with authenticated encryption
   */
  const encryptFile = useCallback(
    async (
      file: File,
      onProgress?: (progress: EncryptionProgress) => void
    ): Promise<EncryptionResult> => {
      try {
        setIsProcessing(true);
        setProgress({
          bytesProcessed: 0,
          totalBytes: file.size,
          percentComplete: 0,
        });

        // Generate encryption key
        const { key: keyHex } = await generateKey();

        // Generate initialization vector (96 bits for AES-GCM)
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const ivHex = Array.from(iv)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Convert key from hex to ArrayBuffer
        const keyBytes = new Uint8Array(
          keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );

        // Import the key
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes.buffer,
          {
            name: ALGORITHM,
            length: KEY_LENGTH,
          },
          false,
          ['encrypt']
        );

        // For large files, process in chunks to avoid memory issues
        if (file.size > CHUNK_SIZE) {
          return await processLargeFile(file, cryptoKey, iv, keyHex, ivHex, onProgress);
        }

        // For smaller files, encrypt all at once
        const fileBuffer = await file.arrayBuffer();

        // Update progress
        updateProgress(0, file.size, onProgress);

        // Encrypt the data
        const encryptedData = await window.crypto.subtle.encrypt(
          {
            name: ALGORITHM,
            iv,
            tagLength: 128, // Authentication tag length (128 bits)
          },
          cryptoKey,
          fileBuffer
        );

        // Combine IV and encrypted data
        const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
        combinedData.set(iv, 0);
        combinedData.set(new Uint8Array(encryptedData), iv.length);

        // Create a new blob with the encrypted data
        const encryptedBlob = new Blob([combinedData], {
          type: 'application/octet-stream',
        });

        // Update final progress
        updateProgress(file.size, file.size, onProgress);

        return {
          success: true,
          data: encryptedBlob,
          encryptionKey: keyHex,
          metadata: {
            algorithm: ALGORITHM,
            keyLength: KEY_LENGTH,
            iv: ivHex,
          },
        };
      } catch (error) {
        console.error('Encryption failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown encryption error',
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [generateKey]
  );

  /**
   * Process encryption for large files in chunks
   */
  const processLargeFile = async (
    file: File,
    cryptoKey: CryptoKey,
    iv: Uint8Array,
    keyHex: string,
    ivHex: string,
    onProgress?: (progress: EncryptionProgress) => void
  ): Promise<EncryptionResult> => {
    try {
      const fileSize = file.size;
      const chunks: ArrayBuffer[] = [];
      let bytesProcessed = 0;

      // Process file in chunks
      for (let start = 0; start < fileSize; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = await file.slice(start, end).arrayBuffer();

        // For AES-GCM, we need to modify the IV for each chunk to maintain security
        // Create a nonce that combines the original IV with the chunk index
        const chunkIv = new Uint8Array(iv);
        
        // XOR the last 4 bytes of the IV with the chunk index
        const chunkIndex = Math.floor(start / CHUNK_SIZE);
        for (let i = 0; i < 4; i++) {
          const bytePos = chunkIv.length - 1 - i;
          if (bytePos >= 0) {
            chunkIv[bytePos] ^= (chunkIndex >> (i * 8)) & 0xff;
          }
        }

        // Encrypt this chunk
        const encryptedChunk = await window.crypto.subtle.encrypt(
          {
            name: ALGORITHM,
            iv: chunkIv,
            tagLength: 128,
          },
          cryptoKey,
          chunk
        );

        chunks.push(encryptedChunk);
        bytesProcessed += chunk.byteLength;

        // Update progress
        updateProgress(bytesProcessed, fileSize, onProgress);
      }

      // Combine all chunks
      const totalEncryptedSize = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
      const combinedData = new Uint8Array(iv.length + totalEncryptedSize);
      
      // Add the IV at the beginning
      combinedData.set(iv, 0);
      
      // Add all encrypted chunks
      let offset = iv.length;
      for (const chunk of chunks) {
        combinedData.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // Create the final encrypted blob
      const encryptedBlob = new Blob([combinedData], {
        type: 'application/octet-stream',
      });

      return {
        success: true,
        data: encryptedBlob,
        encryptionKey: keyHex,
        metadata: {
          algorithm: ALGORITHM,
          keyLength: KEY_LENGTH,
          iv: ivHex,
        },
      };
    } catch (error) {
      console.error('Large file encryption failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error',
      };
    }
  };

  /**
   * Decrypt a file
   */
  const decryptFile = useCallback(
    async (
      encryptedFile: File,
      encryptionKey: string,
      originalType: string,
      onProgress?: (progress: EncryptionProgress) => void
    ): Promise<EncryptionResult> => {
      try {
        setIsProcessing(true);
        setProgress({
          bytesProcessed: 0,
          totalBytes: encryptedFile.size,
          percentComplete: 0,
        });

        // Convert key from hex to ArrayBuffer
        const keyBytes = new Uint8Array(
          encryptionKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );

        // Read the file as ArrayBuffer
        const fileBuffer = await encryptedFile.arrayBuffer();
        
        // Extract IV (first 12 bytes) and encrypted data
        const iv = new Uint8Array(fileBuffer.slice(0, 12));
        const encryptedData = fileBuffer.slice(12);

        // Import the key
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes.buffer,
          {
            name: ALGORITHM,
            length: KEY_LENGTH,
          },
          false,
          ['decrypt']
        );

        // Update progress
        updateProgress(0, encryptedFile.size, onProgress);

        // Decrypt the data
        const decryptedData = await window.crypto.subtle.decrypt(
          {
            name: ALGORITHM,
            iv,
            tagLength: 128,
          },
          cryptoKey,
          encryptedData
        );

        // Create a new blob with the decrypted data
        const decryptedBlob = new Blob([decryptedData], {
          type: originalType || 'application/octet-stream',
        });

        // Update final progress
        updateProgress(encryptedFile.size, encryptedFile.size, onProgress);

        return {
          success: true,
          data: decryptedBlob,
        };
      } catch (error) {
        console.error('Decryption failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown decryption error',
        };
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Update progress state
   */
  const updateProgress = (
    bytesProcessed: number,
    totalBytes: number,
    onProgress?: (progress: EncryptionProgress) => void
  ) => {
    const percentComplete = Math.round((bytesProcessed / totalBytes) * 100);
    
    const progressData = {
      bytesProcessed,
      totalBytes,
      percentComplete,
    };
    
    setProgress(progressData);
    if (onProgress) {
      onProgress(progressData);
    }
  };

  /**
   * Verify if the WebCrypto API is available
   */
  const isSupported = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      window.crypto &&
      window.crypto.subtle &&
      typeof window.crypto.subtle.encrypt === 'function'
    );
  }, []);

  return {
    encryptFile,
    decryptFile,
    generateKey,
    isProcessing,
    progress,
    isSupported,
  };
}
