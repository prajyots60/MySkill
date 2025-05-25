// Test script for IV serialization
console.log('Testing secureMetadata handling...');

const testData = { 
  secureMetadata: { 
    encryptionIV: '123456789abcdef123456789abcdef', 
    encryptionAlgorithm: 'AES-GCM' 
  } 
};

console.log('Original secureMetadata:', testData.secureMetadata);

try {
  const serialized = JSON.stringify({ data: testData });
  console.log('Serialized:', serialized.substring(0, 100) + '...');
  
  const lecture = JSON.parse(serialized);
  console.log('After JSON round-trip:', lecture.data.secureMetadata);
  console.log('IV present after serialization:', !!lecture.data.secureMetadata.encryptionIV);
} catch (e) {
  console.error('Error:', e);
}
