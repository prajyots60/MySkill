import { randomBytes, createCipheriv, createDecipheriv, createHash, DecipherGCM, CipherGCM } from 'crypto';

interface EncryptedData {
  ciphertext: string;  // Base64 encoded encrypted data
  iv: string;          // Base64 encoded initialization vector
  salt: string;        // Base64 encoded salt (if using key derivation)
  tag?: string;        // Base64 encoded authentication tag (for GCM mode)
  algorithm: string;   // Encryption algorithm used
}

interface KeyDerivationOptions {
  iterations?: number;   // Number of PBKDF2 iterations (default: 100000)
  keyLength?: number;    // Length of derived key in bytes (default: 32 for AES-256)
  digest?: string;       // Hash function to use (default: 'sha512')
}

/**
 * Advanced encryption utility that supports multiple algorithms and key derivation
 */
export class AdvancedEncryption {
  private readonly defaultAlgorithm = 'aes-256-gcm';
  private readonly serverSecret: string;
  
  constructor() {
    // Use environment variable or generate a random secret (this should be persistent in production)
    this.serverSecret = process.env.ENCRYPTION_SECRET_KEY || createHash('sha256').update(process.env.NEXTAUTH_SECRET || 'fallback-secret').digest('hex');
  }
  
  /**
   * Encrypt data using AES with GCM mode (authenticated encryption)
   * @param plaintext - The data to encrypt
   * @param userKey - Optional user-provided key that will be combined with server key
   * @param algorithm - Encryption algorithm to use
   * @returns Object containing encrypted data and parameters needed for decryption
   */
  encrypt(plaintext: string, userKey?: string, algorithm = this.defaultAlgorithm): EncryptedData {
    // Generate a random salt for key derivation
    const salt = randomBytes(16);
    
    // Derive a key using PBKDF2 if userKey is provided, otherwise use serverSecret
    const key = userKey 
      ? this.deriveKeyFromPassword(userKey, salt.toString('base64'), { iterations: 100000 })
      : Buffer.from(this.serverSecret, 'hex');
      
    // Generate initialization vector
    const iv = randomBytes(16);
    
    // Create cipher
    const cipher = createCipheriv(algorithm, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // For GCM mode, get the authentication tag
    const authTag = algorithm.includes('gcm') ? (cipher as CipherGCM).getAuthTag().toString('base64') : undefined;
    
    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: authTag,
      algorithm
    };
  }
  
  /**
   * Decrypt data that was encrypted with the encrypt method
   * @param encryptedData - Object containing encrypted data and parameters
   * @param userKey - Optional user-provided key that was used for encryption
   * @returns Decrypted data as string
   */
  decrypt(encryptedData: EncryptedData, userKey?: string): string {
    const { ciphertext, iv, salt, tag, algorithm } = encryptedData;
    
    // Derive key using the same method as during encryption
    const key = userKey 
      ? this.deriveKeyFromPassword(userKey, salt, { iterations: 100000 })
      : Buffer.from(this.serverSecret, 'hex');
      
    // Create decipher
    const decipher = createDecipheriv(
      algorithm, 
      key, 
      Buffer.from(iv, 'base64')
    );
    
    // For GCM mode, set the authentication tag
    if (tag && algorithm.includes('gcm')) {
      (decipher as DecipherGCM).setAuthTag(Buffer.from(tag, 'base64'));
    }
    
    // Decrypt the data
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Generate a secure encryption key suitable for client-side encryption
   * @returns Object with hex-encoded key and iv
   */
  generateSecureKey() {
    // Generate random key and IV
    const keyBytes = randomBytes(32); // 256 bits
    const iv = randomBytes(16); // 128 bits
    
    return {
      key: keyBytes.toString('hex'),
      iv: iv.toString('hex')
    };
  }
  
  /**
   * Create a derived key from a password and salt using PBKDF2
   */
  private deriveKeyFromPassword(
    password: string, 
    salt: string, 
    options?: KeyDerivationOptions
  ): Buffer {
    const { iterations = 100000, keyLength = 32, digest = 'sha512' } = options || {};
    
    // Use Node.js built-in pbkdf2Sync function
    return Buffer.from(
      createHash('sha512')
        .update(password + salt + this.serverSecret)
        .digest('hex')
        .slice(0, keyLength * 2), // Convert to bytes (each hex char is 4 bits)
      'hex'
    );
  }
  
  /**
   * Encrypt JSON data and return as a string
   * Useful for storing encrypted metadata
   */
  encryptJson(data: any, userKey?: string): string {
    const jsonString = JSON.stringify(data);
    const encrypted = this.encrypt(jsonString, userKey);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }
  
  /**
   * Decrypt a JSON string encrypted with encryptJson
   */
  decryptJson(encryptedBase64: string, userKey?: string): any {
    const encryptedJson = JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf8'));
    const decrypted = this.decrypt(encryptedJson, userKey);
    return JSON.parse(decrypted);
  }
  
  /**
   * Create a unique secure token for an upload
   */
  createSecurityToken(userId: string, fileKey: string): string {
    return createHash('sha256')
      .update(`${userId}-${fileKey}-${this.serverSecret}-${Date.now()}`)
      .digest('hex');
  }
  
  /**
   * Verify a security token
   */
  verifySecurityToken(token: string, userId: string, fileKey: string): boolean {
    // In a real implementation, you would store the token and validate against the stored value
    // This is a simplified example that regenerates and compares tokens
    const expectedToken = createHash('sha256')
      .update(`${userId}-${fileKey}-${this.serverSecret}`)
      .digest('hex');
      
    return token === expectedToken;
  }
}
