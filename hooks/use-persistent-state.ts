import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { useLocalStorage } from './use-local-storage';

type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Custom hook for persistent state management with automatic storage sync
 * This hook combines the benefits of useState with automatic persistence to either localStorage or sessionStorage
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  storageType: StorageType = 'localStorage',
  ttl?: number // Time to live in milliseconds
): [T, Dispatch<SetStateAction<T>>, () => void] {
  // Use the appropriate storage hook based on the storage type
  const [storedValue, setStoredValue] = useLocalStorage<T>(
    key,
    initialValue,
    storageType === 'sessionStorage' ? true : false,
    ttl
  );

  // Create a state to track the current value
  const [state, setState] = useState<T>(storedValue);

  // Update the storage when the state changes
  useEffect(() => {
    setStoredValue(state);
  }, [state, setStoredValue]);

  // Clear the persistent state
  const clearState = useCallback(() => {
    setStoredValue(initialValue);
    setState(initialValue);
  }, [initialValue, setStoredValue]);

  return [state, setState, clearState];
}

export default usePersistentState;
