// Web Worker for handling file encryption operations
// This worker runs in a separate thread to prevent UI blocking

// Handle incoming messages from the main thread
self.onmessage = async (event) => {
  try {
    const { operation, data } = event.data;
    
    // Handle different operations
    switch (operation) {
      case 'encrypt':
        const encryptedData = await encryptFile(data.fileBuffer, data.key);
        self.postMessage({ 
          status: 'success', 
          result: encryptedData,
          operation: 'encrypt'
        });
        break;
        
      case 'decrypt':
        const decryptedData = await decryptFile(data.fileBuffer, data.key);
        self.postMessage({ 
          status: 'success', 
          result: decryptedData,
          operation: 'decrypt'
        });
        break;
        
      case 'generateKey':
        const keyData = await generateEncryptionKey();
        self.postMessage({ 
          status: 'success', 
          result: keyData,
          operation: 'generateKey'
        });
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    self.postMessage({ 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error),
      operation: event.data?.operation 
    });
  }
};

// Generate a secure encryption key
async function generateEncryptionKey() {
  // Generate key (32 bytes/256-bits for AES-256)
  const keyArray = new Uint8Array(32);
  crypto.getRandomValues(keyArray);
  
  // Generate IV (16 bytes/128-bits for AES-CBC)
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  return {
    key: Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

// Encrypt a file using AES-GCM (matching API configuration)
async function encryptFile(fileBuffer: ArrayBuffer, key: string) {
  // Convert hex key to Uint8Array
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Generate an initialization vector - 12 bytes for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // For storage and compatibility, pad IV to 16 bytes
  const storedIv = new Uint8Array(16);
  storedIv.set(iv);
  
  // Import the key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { 
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt']
  );
  
  // No padding needed for GCM mode
  
  // Encrypt the file data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    cryptoKey,
    fileBuffer
  );
  
  // Combine IV (padded to 16 bytes) and encrypted data
  const combinedData = new Uint8Array(storedIv.length + encryptedData.byteLength);
  combinedData.set(storedIv, 0);
  combinedData.set(new Uint8Array(encryptedData), storedIv.length);
  
  return combinedData;
}

// Decrypt a file
async function decryptFile(fileBuffer: ArrayBuffer, key: string) {
  // Convert hex key string to Uint8Array 
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Extract IV (first 16 bytes) and encrypted data
  const storedIv = new Uint8Array(fileBuffer.slice(0, 16));
  const encryptedData = fileBuffer.slice(16);
  
  // Try AES-GCM first (matching our API configuration)
  try {
    // For GCM, use only first 12 bytes of IV
    const iv = storedIv.slice(0, 12);
    
    // Import the key for AES-GCM
    const gcmKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { 
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    );
    
    // Decrypt with AES-GCM
    return await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      gcmKey,
      encryptedData
    );
  } catch (gcmError) {
    console.log('GCM decryption failed, trying CBC:', gcmError);
    
    // Fall back to AES-CBC for backwards compatibility
    // Import the key for AES-CBC
    const cbcKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { 
        name: 'AES-CBC',
        length: 256
      },
      false,
      ['decrypt']
    );
    
    // Decrypt the data with CBC
    const decryptedDataWithPadding = await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: storedIv
      },
      cbcKey,
      encryptedData
    );
    
    // Remove PKCS7 padding
    const decryptedArray = new Uint8Array(decryptedDataWithPadding);
    const paddingSize = decryptedArray[decryptedArray.length - 1];
    
    // Validate padding is correct
    const isPaddingValid = paddingSize <= 16 && paddingSize > 0;
    if (isPaddingValid) {
      // Verify all padding bytes have the same value
      const padding = decryptedArray.slice(-paddingSize);
      const isValidPadding = padding.every(byte => byte === paddingSize);
      if (isValidPadding) {
        return decryptedDataWithPadding.slice(0, decryptedDataWithPadding.byteLength - paddingSize);
      }
    }
    
    // If padding appears invalid, return data as is
    return decryptedDataWithPadding;
  }
}
