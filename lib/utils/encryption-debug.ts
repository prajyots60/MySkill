/**
 * Encryption debug utilities
 * These functions are used to diagnose encryption/decryption issues
 */

/**
 * Validates an encryption IV
 * @param iv The IV to validate
 * @returns An object with validation results
 */
export function validateIV(iv: string | null | undefined): {
  isValid: boolean;
  error?: string;
  hexValue?: string;
  byteLength?: number;
} {
  if (!iv) {
    return {
      isValid: false,
      error: 'IV is null or undefined'
    };
  }

  // Check if IV is a valid hex string with correct length
  if (!/^[0-9a-fA-F]+$/.test(iv)) {
    return {
      isValid: false,
      error: `IV contains non-hex characters: ${iv.substring(0, 10)}...`,
      hexValue: iv
    };
  }

  // For AES-GCM, IV should be 12 bytes (24 hex chars)
  if (iv.length !== 24) {
    return {
      isValid: false,
      error: `IV has incorrect length: ${iv.length} hex chars (should be 24 for 12 bytes)`,
      hexValue: iv,
      byteLength: iv.length / 2
    };
  }

  return {
    isValid: true,
    hexValue: iv,
    byteLength: 12
  };
}

/**
 * Converts a hex string IV to bytes
 * @param hexIV Hex string IV
 * @returns Uint8Array of bytes
 */
export function hexIVToBytes(hexIV: string): Uint8Array {
  const validation = validateIV(hexIV);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const bytes = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    bytes[i] = parseInt(hexIV.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Converts bytes to a hex string IV
 * @param bytes Byte array
 * @returns Hex string IV
 */
export function bytesToHexIV(bytes: Uint8Array): string {
  if (bytes.length !== 12) {
    throw new Error(`Invalid IV byte length: ${bytes.length} (should be 12)`);
  }

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
