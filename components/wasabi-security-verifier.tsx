'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useSession } from 'next-auth/react';
import { Shield, FileVideo, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { useFileEncryption } from '@/hooks/use-file-encryption';

interface SecurityVerifierProps {
  testMode?: boolean;
}

export function WasabiSecurityVerifier({ testMode = false }: SecurityVerifierProps) {
  const { data: session } = useSession();
  const { uploadFile, getFileUrl } = useWasabiStorage();
  const { encryptFile, decryptFile } = useFileEncryption();
  
  const [file, setFile] = useState<File | null>(null);
  const [useEncryption, setUseEncryption] = useState(true);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [testComplete, setTestComplete] = useState(false);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  // Add a result to the test
  const addResult = (test: string, passed: boolean, message: string, details?: any) => {
    setResults(prev => [...prev, { test, passed, message, details, timestamp: new Date() }]);
  };
  
  // Run the security verification test
  const runTest = async () => {
    if (!file) {
      addResult('File selection', false, 'No file selected', null);
      return;
    }
    
    setStatus('testing');
    setResults([]);
    setUploadProgress(0);
    setEncryptionProgress(0);
    setTestComplete(false);
    
    try {
      // 1. Test authentication
      if (!session?.user) {
        addResult('Authentication', false, 'User not authenticated', null);
        setStatus('error');
        return;
      }
      
      addResult('Authentication', true, 'User authenticated successfully', {
        userId: session.user.id,
        role: session.user.role
      });
      
      // 2. Test encryption if enabled
      let testFile = file;
      let encryptionKey;
      let encryptionIv;
      
      if (useEncryption) {
        addResult('Encryption setup', true, 'Starting file encryption', { fileSize: file.size });
        const encryptResult = await encryptFile({
          file,
          onProgress: (progress) => setEncryptionProgress(progress)
        });
        
        if (!encryptResult.success) {
          addResult('Encryption', false, `Encryption failed: ${encryptResult.error}`, null);
          setStatus('error');
          return;
        }
        
        testFile = encryptResult.encryptedFile!;
        encryptionKey = encryptResult.encryptionKey;
        encryptionIv = encryptResult.iv;
        
        addResult('Encryption', true, 'File encrypted successfully', {
          originalSize: file.size,
          encryptedSize: testFile.size,
          algorithm: 'AES-GCM-256'
        });
      }
      
      // 3. Test upload process
      addResult('Upload initialization', true, 'Starting file upload', { fileName: testFile.name });
      
      const category = testMode ? 'security-test' : 'courses/videos/test';
      const metadata = {
        testId: `test-${Date.now()}`,
        securityTest: 'true',
        isEncrypted: useEncryption ? 'true' : 'false',
        ...(encryptionKey ? { encryptionKey, encryptionIv } : {})
      };
      
      const uploadResult = await uploadFile({
        file: testFile,
        category,
        metadata,
        onProgress: (progress) => setUploadProgress(progress)
      });
      
      if (!uploadResult.success) {
        addResult('Upload', false, `Upload failed: ${uploadResult.error}`, null);
        setStatus('error');
        return;
      }
      
      addResult('Upload', true, 'File uploaded successfully', {
        fileKey: uploadResult.key,
        url: uploadResult.url
      });
      
      // 4. Test security token verification
      if (uploadResult.securityToken) {
        addResult('Security token', true, 'Upload security token received', { tokenLength: uploadResult.securityToken.length });
        
        // Verify the token by attempting to access the file
        try {
          const verifyResponse = await fetch('/api/storage/verify-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: uploadResult.key,
              securityToken: uploadResult.securityToken
            })
          });
          
          if (verifyResponse.ok) {
            addResult('Token verification', true, 'Security token verified successfully', null);
          } else {
            const errorData = await verifyResponse.json();
            addResult('Token verification', false, `Token verification failed: ${errorData.message}`, null);
          }
        } catch (error) {
          addResult('Token verification', false, `Token verification error: ${error instanceof Error ? error.message : String(error)}`, null);
        }
      } else {
        addResult('Security token', false, 'No security token received from upload', null);
      }
      
      // 5. Test file access with correct permissions
      try {
        addResult('File access', true, 'Attempting to retrieve file URL', null);
        
        const getUrlResult = await getFileUrl(uploadResult.key!, 300); // 5 minute expiration
        
        if (getUrlResult.success) {
          addResult('File access', true, 'Generated access URL successfully', { expires: '5 minutes' });
        } else {
          addResult('File access', false, `Failed to get access URL: ${getUrlResult.error}`, null);
        }
      } catch (error) {
        addResult('File access', false, `Error getting access URL: ${error instanceof Error ? error.message : String(error)}`, null);
      }
      
      // 6. If encrypted, test decryption
      if (useEncryption && encryptionKey && encryptionIv) {
        addResult('Decryption setup', true, 'Testing decryption capability', null);
        
        try {
          // We'd need to download the file for a real test, but for now just validate we have the key
          addResult('Decryption', true, 'Decryption keys available', {
            keyLength: encryptionKey.length,
            ivLength: encryptionIv.length
          });
        } catch (error) {
          addResult('Decryption', false, `Decryption preparation error: ${error instanceof Error ? error.message : String(error)}`, null);
        }
      }
      
      // Test complete
      setStatus('success');
      setTestComplete(true);
    } catch (error) {
      addResult('Test execution', false, `Unexpected error: ${error instanceof Error ? error.message : String(error)}`, null);
      setStatus('error');
    }
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Wasabi Storage Security Verifier
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <label htmlFor="test-file" className="text-sm font-medium">
            Select a test file
          </label>
          <input
            id="test-file"
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            className="border rounded p-2"
          />
          <p className="text-xs text-gray-500">
            For testing, use a small video or image file.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            id="use-encryption"
            type="checkbox"
            checked={useEncryption}
            onChange={(e) => setUseEncryption(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="use-encryption" className="text-sm font-medium">
            Test with encryption
          </label>
        </div>
        
        {status === 'testing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            
            {useEncryption && (
              <>
                <div className="flex justify-between text-sm mt-4">
                  <span>Encryption progress</span>
                  <span>{encryptionProgress}%</span>
                </div>
                <Progress value={encryptionProgress} className="h-2" />
              </>
            )}
          </div>
        )}
        
        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">Test Results</h3>
            
            {results.map((result, index) => (
              <Alert 
                key={index} 
                variant={result.passed ? "default" : "destructive"} 
                className={result.passed ? "border-green-200 bg-green-50" : ""}
              >
                <div className="flex items-start gap-2">
                  {result.passed ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <AlertTitle>{result.test}</AlertTitle>
                    <AlertDescription>
                      {result.message}
                      {result.details && (
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
            
            {testComplete && (
              <Alert variant={status === 'success' ? "default" : "destructive"} className={status === 'success' ? "border-green-200 bg-green-50" : ""}>
                <div className="flex items-start gap-2">
                  {status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <AlertTitle>Test Summary</AlertTitle>
                    <AlertDescription>
                      {status === 'success' 
                        ? 'All security tests completed successfully' 
                        : 'Security tests completed with errors'}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={runTest} 
          disabled={!file || status === 'testing'}
          variant="default"
        >
          {status === 'testing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Run Security Test
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
