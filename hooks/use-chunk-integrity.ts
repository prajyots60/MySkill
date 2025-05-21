'use client';

import { useState, useCallback } from 'react';

interface ChunkIntegrityResult {
  chunkIndex: number;
  isValid: boolean;
  errorMessage?: string;
  checksum: string;
  size: number;
}

type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5';

/**
 * Hook for client-side integrity checks for file chunks
 */
export function useChunkIntegrity(algorithm: HashAlgorithm = 'SHA-256') {
  const [verificationResults, setVerificationResults] = useState<Map<number, ChunkIntegrityResult>>(new Map());

  /**
   * Calculate checksum for a file chunk
   */
  const calculateChecksum = useCallback(async (
    chunk: Blob,
    chunkIndex: number,
  ): Promise<ChunkIntegrityResult> => {
    try {
      // Read chunk as array buffer
      const arrayBuffer = await chunk.arrayBuffer();
      
      // Use Web Crypto API to generate digest
      const hashBuffer = await crypto.subtle.digest(algorithm, arrayBuffer);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      const result: ChunkIntegrityResult = {
        chunkIndex,
        isValid: true,
        checksum: hashHex,
        size: chunk.size,
      };
      
      // Store result
      setVerificationResults(prev => {
        const updated = new Map(prev);
        updated.set(chunkIndex, result);
        return updated;
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: ChunkIntegrityResult = {
        chunkIndex,
        isValid: false,
        errorMessage,
        checksum: '',
        size: chunk.size,
      };
      
      // Store result
      setVerificationResults(prev => {
        const updated = new Map(prev);
        updated.set(chunkIndex, result);
        return updated;
      });
      
      return result;
    }
  }, [algorithm]);

  /**
   * Verify a chunk against stored checksum
   */
  const verifyChunkIntegrity = useCallback(async (
    chunk: Blob,
    chunkIndex: number,
    expectedChecksum?: string
  ): Promise<boolean> => {
    const result = await calculateChecksum(chunk, chunkIndex);
    
    if (expectedChecksum && result.checksum !== expectedChecksum) {
      // Update result with validation failure
      const updatedResult: ChunkIntegrityResult = {
        ...result,
        isValid: false,
        errorMessage: 'Checksum verification failed',
      };
      
      setVerificationResults(prev => {
        const updated = new Map(prev);
        updated.set(chunkIndex, updatedResult);
        return updated;
      });
      
      return false;
    }
    
    return result.isValid;
  }, [calculateChecksum]);

  /**
   * Get all verification results
   */
  const getVerificationResults = useCallback(() => {
    return Array.from(verificationResults.values());
  }, [verificationResults]);

  /**
   * Clear verification results
   */
  const clearResults = useCallback(() => {
    setVerificationResults(new Map());
  }, []);

  return {
    calculateChecksum,
    verifyChunkIntegrity,
    getVerificationResults,
    clearResults,
    algorithm,
  };
}

export default useChunkIntegrity;
