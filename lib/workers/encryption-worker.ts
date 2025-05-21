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
  // Generate key
  const keyArray = new Uint8Array(16); // 128-bit key for AES-128
  crypto.getRandomValues(keyArray);
  
  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  return {
    key: Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

// Encrypt a file
async function encryptFile(fileBuffer: ArrayBuffer, key: string) {
  // Convert hex key to Uint8Array
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Generate an initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Import the key for use with AES-CBC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  // Encrypt the file data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv
    },
    cryptoKey,
    fileBuffer
  );
  
  // Combine IV and encrypted data
  const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
  combinedData.set(iv, 0);
  combinedData.set(new Uint8Array(encryptedData), iv.length);
  
  return combinedData;
}

// Decrypt a file
async function decryptFile(fileBuffer: ArrayBuffer, key: string) {
  // Convert hex key string to Uint8Array
  const keyBytes = new Uint8Array(
    key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Extract IV (first 16 bytes) and encrypted data
  const iv = new Uint8Array(fileBuffer.slice(0, 16));
  const encryptedData = fileBuffer.slice(16);
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv
    },
    cryptoKey,
    encryptedData
  );
  
  return decryptedData;
}
