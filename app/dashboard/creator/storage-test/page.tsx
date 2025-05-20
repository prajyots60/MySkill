'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

export default function StorageTestPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testFile, setTestFile] = useState<File | null>(null);

  // Check Wasabi configuration on load
  useEffect(() => {
    if (status === 'authenticated') {
      checkWasabiConfig();
    }
  }, [status]);

  // Function to check Wasabi configuration
  const checkWasabiConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/storage/check-config');
      
      if (!response.ok) {
        throw new Error('Failed to fetch storage configuration');
      }
      
      const data = await response.json();
      setConfigData(data);
    } catch (error) {
      console.error('Error checking storage config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check storage configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to test bucket access
  const testBucketAccess = async () => {
    try {
      setTestStatus('testing');
      setTestError(null);
      
      const response = await fetch('/api/storage/test-bucket-access');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to test bucket access');
      }
      
      const data = await response.json();
      setTestResult(data);
      setTestStatus('success');
    } catch (error) {
      console.error('Error testing bucket access:', error);
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Failed to test bucket access');
    }
  };

  // Handle test file selection
  const handleTestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTestFile(e.target.files[0]);
    }
  };

  // Test file upload
  const testFileUpload = async () => {
    if (!testFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setTestStatus('testing');
      setTestError(null);
      
      // Create a small test upload
      const formData = new FormData();
      formData.append('file', testFile);
      formData.append('purpose', 'test');
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload test file');
      }
      
      const data = await response.json();
      setTestResult(data);
      setTestStatus('success');
      
      toast({
        title: 'Success',
        description: 'Test file uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading test file:', error);
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Failed to upload test file');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Storage System Test</h1>
        
        {configData && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Storage Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Region:</h3>
                    <p>{configData.config.region || 'Not configured'}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Bucket:</h3>
                    <p>{configData.config.bucket || 'Not configured'}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Access Key:</h3>
                    <p>
                      {configData.config.hasAccessKey ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Configured
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-4 w-4 mr-1" /> Missing
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Secret Key:</h3>
                    <p>
                      {configData.config.hasSecretKey ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Configured
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-4 w-4 mr-1" /> Missing
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Credentials Verified:</h3>
                    <p>
                      {configData.config.credentialsVerified ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Valid
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-4 w-4 mr-1" /> Invalid or Unverified
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Bucket Accessible:</h3>
                    <p>
                      {configData.config.bucketsAccessible ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Accessible
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-4 w-4 mr-1" /> Not Accessible
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {(!configData.config.credentialsVerified || !configData.config.bucketsAccessible) && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Storage Configuration Issue</AlertTitle>
                    <AlertDescription>
                      {!configData.config.credentialsVerified && (
                        <p>The storage credentials are invalid or expired. Contact your administrator.</p>
                      )}
                      {!configData.config.bucketsAccessible && configData.config.credentialsVerified && (
                        <p>The credentials are valid but cannot access the required bucket. Check bucket permissions.</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={checkWasabiConfig}>Refresh Configuration</Button>
            </CardFooter>
          </Card>
        )}
        
        <Tabs defaultValue="bucket-test">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bucket-test">Bucket Access Test</TabsTrigger>
            <TabsTrigger value="upload-test">Upload Test</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bucket-test" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Bucket Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  This test will attempt to list objects in the configured bucket to verify access permissions.
                </p>
                
                {testStatus === 'success' && testResult && (
                  <Alert className="mb-4 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Success</AlertTitle>
                    <AlertDescription className="text-green-700">
                      {testResult.message}
                    </AlertDescription>
                  </Alert>
                )}
                
                {testStatus === 'error' && testError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{testError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={testBucketAccess} 
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Bucket Access'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="upload-test" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Test File Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  This test will upload a small file to the bucket to verify write permissions.
                </p>
                
                <div className="mb-4">
                  <Label htmlFor="test-file">Select a small file to upload</Label>
                  <Input
                    id="test-file"
                    type="file"
                    onChange={handleTestFileChange}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommendation: Use a small image or text file for testing.
                  </p>
                </div>
                
                {testStatus === 'success' && testResult && (
                  <Alert className="mb-4 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Success</AlertTitle>
                    <AlertDescription className="text-green-700">
                      File uploaded successfully.
                      {testResult.url && (
                        <p className="mt-2">
                          <a 
                            href={testResult.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View uploaded file
                          </a>
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                {testStatus === 'error' && testError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{testError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={testFileUpload} 
                  disabled={testStatus === 'testing' || !testFile}
                >
                  {testStatus === 'testing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Test Upload'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
