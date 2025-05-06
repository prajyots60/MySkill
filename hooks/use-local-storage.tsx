"use client"

import { useState, useEffect, useCallback } from "react"

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key)
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      // If error also return initialValue
      console.error("Error reading from localStorage:", error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value

        // Save state
        setStoredValue(valueToStore)

        // Save to local storage
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        // A more advanced implementation would handle the error case
        console.error("Error setting localStorage value:", error)
      }
    },
    [key, storedValue],
  )

  // Listen for changes to this localStorage key from other tabs/windows
  useEffect(() => {
    if (typeof window === "undefined") return

    // This function will be called when the localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.error("Error parsing localStorage value:", error)
        }
      }
    }

    // Add event listener
    window.addEventListener("storage", handleStorageChange)

    // Remove event listener on cleanup
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [key])

  return [storedValue, setValue] as const
}

// Enhanced version with expiration support
export function useLocalStorageWithExpiry<T>(key: string, initialValue: T, expiryInMinutes: number) {
  const [storedValue, setStoredValue] = useLocalStorage<{
    value: T
    expiry: number | null
  }>(key, {
    value: initialValue,
    expiry: null,
  })

  // Check if the stored value is expired
  const isExpired = storedValue.expiry && new Date().getTime() > storedValue.expiry

  // If the value is expired, return the initial value
  const currentValue = isExpired ? initialValue : storedValue.value

  // Set a new value with an expiry time
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore = value instanceof Function ? value(currentValue) : value

      // Calculate expiry time
      const expiry = expiryInMinutes ? new Date().getTime() + expiryInMinutes * 60 * 1000 : null

      setStoredValue({
        value: valueToStore,
        expiry,
      })
    },
    [currentValue, expiryInMinutes, setStoredValue],
  )

  return [currentValue, setValue] as const
}
