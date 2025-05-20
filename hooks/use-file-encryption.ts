'use client';

import { useState, useCallback } from 'react';

interface EncryptionOptions {
  /**
   * The file to encrypt
   */
  file: File;
  
  /**
   * Optional callback for encryption progress
   */
  onProgress?: (progress: number) => void;
}

interface EncryptionResult {
  /**
   * Whether encryption was successful
   */
  success: boolean;
  
  /**
   * The encrypted file
   */
  encryptedFile?: File;
  
  /**
   * The encryption key to decrypt the file
   */
  encryptionKey?: string;
  
  /**
   * The initialization vector used for encryption
   */
  iv?: string;
  
  /**
   * Error message if encryption failed
   */
  error?: string;
}

/**
 * Hook for client-side file encryption before upload
 */
export function useFileEncryption() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);

  /**
   * Encrypt a file using AES-GCM for authenticated encryption
   */
  const encryptFile = useCallback(async ({ 
    file, 
    onProgress 
  }: EncryptionOptions): Promise<EncryptionResult> => {
    try {
      setIsEncrypting(true);
      setEncryptionProgress(0);
      if (onProgress) onProgress(0);

      // Generate a random encryption key
      const keyArray = new Uint8Array(32); // 256-bit key for AES-256
      window.crypto.getRandomValues(keyArray);
      
      // Convert key to hex string for storage
      const encryptionKey = Array.from(keyArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Generate an initialization vector
      const ivArray = new Uint8Array(12); // 96 bits for AES-GCM
      window.crypto.getRandomValues(ivArray);
      
      // Convert IV to hex string for storage
      const iv = Array.from(ivArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Read file as ArrayBuffer
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
        
        setEncryptionProgress(10);
        if (onProgress) onProgress(10);
      });
      
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyArray.buffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      setEncryptionProgress(30);
      if (onProgress) onProgress(30);
      
      // Encrypt the file
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: ivArray,
          tagLength: 128 // 128-bit authentication tag
        },
        cryptoKey,
        fileBuffer
      );
      
      setEncryptionProgress(80);
      if (onProgress) onProgress(80);
      
      // Combine IV and encrypted data for storage
      // Format: [IV (12 bytes)] + [encrypted data]
      const combinedData = new Uint8Array(ivArray.length + encryptedData.byteLength);
      combinedData.set(ivArray, 0);
      combinedData.set(new Uint8Array(encryptedData), ivArray.length);
      
      // Create a new File object with the encrypted data
      const encryptedFile = new File(
        [combinedData], 
        `${file.name}.encrypted`, 
        { type: 'application/octet-stream' }
      );
      
      setEncryptionProgress(100);
      if (onProgress) onProgress(100);
      
      return {
        success: true,
        encryptedFile,
        encryptionKey,
        iv
      };
    } catch (error) {
      console.error('File encryption failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error'
      };
    } finally {
      setIsEncrypting(false);
      setEncryptionProgress(0);
    }
  }, []);

  /**
   * Decrypt an encrypted file using the provided key and IV
   */
  const decryptFile = useCallback(async (
    encryptedFile: File,
    encryptionKey: string,
    iv: string,
    originalType: string,
    onProgress?: (progress: number) => void
  ) => {
    try {
      setIsEncrypting(true);
      setEncryptionProgress(0);
      if (onProgress) onProgress(0);
      
      // Convert hex key and IV back to Uint8Array
      const keyArray = new Uint8Array(
        encryptionKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      
      const ivArray = new Uint8Array(
        iv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      
      // Read encrypted file as ArrayBuffer
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(encryptedFile);
        
        setEncryptionProgress(10);
        if (onProgress) onProgress(10);
      });
      
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyArray.buffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      setEncryptionProgress(30);
      if (onProgress) onProgress(30);
      
      // The encrypted file contains the IV at the beginning
      // Extract just the encrypted data portion, skipping the IV
      const encryptedData = fileBuffer.slice(ivArray.length);
      
      // Decrypt the file
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivArray,
          tagLength: 128
        },
        cryptoKey,
        encryptedData
      );
      
      setEncryptionProgress(80);
      if (onProgress) onProgress(80);
      
      // Create a new File object with the decrypted data
      const originalName = encryptedFile.name.endsWith('.encrypted')
        ? encryptedFile.name.slice(0, -10) // Remove .encrypted suffix
        : encryptedFile.name;
        
      const decryptedFile = new File(
        [decryptedData], 
        originalName, 
        { type: originalType }
      );
      
      setEncryptionProgress(100);
      if (onProgress) onProgress(100);
      
      return {
        success: true,
        decryptedFile
      };
    } catch (error) {
      console.error('File decryption failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown decryption error'
      };
    } finally {
      setIsEncrypting(false);
      setEncryptionProgress(0);
    }
  }, []);

  return {
    encryptFile,
    decryptFile,
    isEncrypting,
    encryptionProgress
  };
}
