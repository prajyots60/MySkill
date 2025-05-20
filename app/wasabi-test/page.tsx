'use client';

import { useState, useEffect } from 'react';

export default function WasabiTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/wasabi-test');
        const data = await response.json();
        setResult(data);
      } catch (error) {
        setResult({ success: false, message: error instanceof Error ? error.message : 'An unexpected error occurred' });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Wasabi Minimal Test</h1>

      {loading && (
        <p>Loading Wasabi status...</p>
      )}

      {!loading && result && (
        <div>
          <h2>Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>

          {result.success ? (
            <p style={{ color: 'green' }}>Successfully connected to Wasabi!</p>
          ) : (
            <p style={{ color: 'red' }}>Failed to connect to Wasabi: {result.message}</p>
          )}
        </div>
      )}

      {!loading && !result && (
        <p>No result received from API.</p>
      )}
    </div>
  );
} 