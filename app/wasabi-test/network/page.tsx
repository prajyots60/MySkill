'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNetworkAwareUpload } from '@/hooks/use-network-aware-upload';
import { RefreshCw, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function NetworkTestPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    downloadSpeed: number;
    latency: number;
    timestamp: number;
    adaptiveConfig?: {
      maxConcurrentChunks: number;
      chunkSize: number;
    };
  }>>([]);
  const [progress, setProgress] = useState(0);

  const { 
    networkStatus, 
    networkSpeed, 
    adaptiveConfig, 
    runNetworkSpeedTest 
  } = useNetworkAwareUpload();

  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get connection status badge - memoized to prevent infinite re-renders
  const connectionStatus = useMemo(() => {
    if (!networkStatus.online) return { label: 'Offline', status: 'offline' as const, color: 'slate' };
    
    if (networkSpeed) {
      const { downloadSpeed } = networkSpeed;
      if (downloadSpeed >= 10) return { label: 'Excellent', status: 'excellent' as const, color: 'green' };
      if (downloadSpeed >= 5) return { label: 'Good', status: 'good' as const, color: 'blue' };
      if (downloadSpeed >= 1) return { label: 'Fair', status: 'fair' as const, color: 'amber' };
      return { label: 'Poor', status: 'poor' as const, color: 'red' };
    }
    
    // Fallback based on Network Information API
    const effectiveType = networkStatus.effectiveType;
    if (effectiveType === '4g') return { label: 'Good', status: 'good' as const, color: 'blue' };
    if (effectiveType === '3g') return { label: 'Fair', status: 'fair' as const, color: 'amber' };
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return { label: 'Poor', status: 'poor' as const, color: 'red' };
    
    return { label: 'Unknown', status: 'fair' as const, color: 'slate' };
  }, [networkStatus.online, networkSpeed, networkStatus.effectiveType]);

  // Run comprehensive network test
  const runComprehensiveTest = async () => {
    setIsRunning(true);
    setProgress(0);
    
    try {
      // Run 5 tests in a row to get better data
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        setProgress((i / 5) * 100);
        const result = await runNetworkSpeedTest();
        if (result) {
          results.push({
            ...result,
            adaptiveConfig: {
              maxConcurrentChunks: adaptiveConfig.maxConcurrentChunks,
              chunkSize: adaptiveConfig.chunkSize
            }
          });
        }
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setTestResults(results);
      setProgress(100);
    } catch (error) {
      console.error("Network test failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Network Speed & Upload Optimization Test</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Network Status</span>
              <Badge className={`bg-${connectionStatus.color}-500/10 text-${connectionStatus.color}-600 border-${connectionStatus.color}-600/20`}>
                <Wifi className="h-3 w-3 mr-1" /> {connectionStatus.label}
              </Badge>
            </CardTitle>
            <CardDescription>
              Current network information and optimization settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Connection Details:</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Status: {networkStatus.online ? 'Online' : 'Offline'}</li>
                  <li>Downlink: {networkStatus.downlink || '?'} Mbps</li>
                  <li>Effective Type: {networkStatus.effectiveType || 'Unknown'}</li>
                  <li>RTT: {networkStatus.rtt || '?'} ms</li>
                  <li>Data Saving: {networkStatus.saveData ? 'Yes' : 'No'}</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-medium">Upload Configuration:</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Chunk Size: {formatFileSize(adaptiveConfig.chunkSize)}</li>
                  <li>Concurrent Uploads: {adaptiveConfig.maxConcurrentChunks}</li>
                  <li>Retry Limit: {adaptiveConfig.retryLimit}</li>
                  <li>Retry Delay: {adaptiveConfig.retryDelay}ms</li>
                  <li>Adaptive Chunking: {adaptiveConfig.adaptiveChunking ? 'Enabled' : 'Disabled'}</li>
                </ul>
              </div>
            </div>
            
            {networkSpeed && (
              <div className="pt-2 border-t">
                <h3 className="text-sm font-medium mb-2">Last Speed Test:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Download Speed: <span className="font-medium">{networkSpeed.downloadSpeed.toFixed(2)} Mbps</span></div>
                  <div>Latency: <span className="font-medium">{networkSpeed.latency} ms</span></div>
                </div>
              </div>
            )}
            
            <div className="flex justify-center pt-2">
              <Button onClick={runComprehensiveTest} disabled={isRunning} className="w-full">
                <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                Run Comprehensive Network Test
              </Button>
            </div>
            
            {isRunning && (
              <div>
                <Progress value={progress} className="mt-2" />
                <p className="text-xs text-center mt-1 text-muted-foreground">Testing network speed and optimizing upload parameters...</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Results from {testResults.length} network speed tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Speed (Mbps)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Latency (ms)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Chunk Size</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Concurrent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {testResults.map((result, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">{result.downloadSpeed.toFixed(2)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">{result.latency}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">{result.adaptiveConfig ? formatFileSize(result.adaptiveConfig.chunkSize) : '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">{result.adaptiveConfig?.maxConcurrentChunks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium mb-2">Average Results:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Average Speed: 
                    <span className="font-medium">
                      {(testResults.reduce((sum, r) => sum + r.downloadSpeed, 0) / testResults.length).toFixed(2)} Mbps
                    </span>
                  </div>
                  <div>Average Latency: 
                    <span className="font-medium">
                      {Math.round(testResults.reduce((sum, r) => sum + r.latency, 0) / testResults.length)} ms
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Try the advanced uploader</CardTitle>
            <CardDescription>
              Test our network-optimized resumable uploader with the new features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/wasabi-test/advanced-upload'}
              className="w-full"
            >
              Go to Advanced Uploader Testing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
