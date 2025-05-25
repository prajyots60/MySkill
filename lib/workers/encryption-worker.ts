// Web Worker for handling file encryption operations
// This worker runs in a separate thread to prevent UI blocking

// Handle incoming messages from the main thread
self.onmessage = async (event) => {
  try {
    const { operation, data } = event.data;
    
    // Handle different operations
    switch (operation) {
      case 'encrypt':
        const encryptionResult = await encryptFile(data.fileBuffer, data.key, data.iv);
        // CRITICAL: Must include IV in the message for decryption to work later
        if (!encryptionResult.iv) {
          throw new Error('No IV generated during encryption - this will break decryption!');
        }
        console.log('Worker using IV:', encryptionResult.iv);
        self.postMessage({ 
          status: 'success', 
          result: encryptionResult.data,
          iv: encryptionResult.iv, // CRITICAL: This must be passed back and saved in the database
          ivLength: encryptionResult.ivLength,
          encryptionTimestamp: encryptionResult.timestamp,
          operation: 'encrypt'
        });
        break;
        
      case 'decrypt':
        // Now using IV from metadata
        const decryptedData = await decryptFile(data.fileBuffer, data.key, data.iv);
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

// Generate a secure encryption key for AES-GCM
async function generateEncryptionKey() {
  // Generate key (32 bytes/256-bits for AES-256)
  const keyArray = new Uint8Array(32);
  crypto.getRandomValues(keyArray);
  
  // Convert to hex string
  return {
    key: Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join(''),
    keyLength: keyArray.length * 8 // Key length in bits (256)
  };
}

// Encrypt a file using AES-GCM
async function encryptFile(fileBuffer: ArrayBuffer, key: string, ivString?: string) {
  // Convert hex key to Uint8Array (256 bits / 32 bytes)
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Use provided IV or generate one - exactly 12 bytes for AES-GCM (standard size)
  let iv: Uint8Array;
  if (ivString) {
    // Convert hex IV to bytes
    iv = new Uint8Array(
      ivString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    // Validate the provided IV length
    if (iv.length !== 12) {
      throw new Error(`Invalid IV length: provided IV must be exactly 12 bytes (24 hex chars)`);
    }
  } else {
    // Generate new IV
    iv = crypto.getRandomValues(new Uint8Array(12));
  }
  
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
  
  // Convert IV to hex string for storage in metadata
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return encrypted data and IV separately - IV will be stored in metadata
  return {
    data: new Uint8Array(encryptedData),
    iv: ivHex,
    ivLength: iv.length,
    timestamp: Date.now()
  };
}

// Decrypt a file using AES-GCM only
async function decryptFile(fileBuffer: ArrayBuffer, key: string, ivString?: string) {
  // Convert hex key string to Uint8Array (256 bits / 32 bytes)
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Use IV from metadata or fail
  if (!ivString) {
    throw new Error('No IV provided for decryption');
  }
  
  // Convert hex IV string to Uint8Array (12 bytes)
  const iv = new Uint8Array(
    ivString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Use the entire buffer as encrypted data (no IV prepended)
  const encryptedData = fileBuffer;
  
  // Import the key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
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
    cryptoKey,
    encryptedData
  );
}
