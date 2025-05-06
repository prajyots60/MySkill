"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useFollowerStore } from "@/lib/store"

/**
 * Custom hook to manage follower data with efficient request deduplication
 * Uses a global Zustand store to prevent duplicate API calls across components
 */
export function useFollowData(creatorId?: string) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  
  // Access the global follower store
  const {
    getFollowerData,
    setFollowerCount,
    setFollowingStatus,
    addPendingRequest,
    removePendingRequest,
    updateLastFetched,
    pendingRequests
  } = useFollowerStore()
  
  // Get cached data values with stale check
  const { count: cachedCount, isFollowing: cachedIsFollowing, needsFresh } = 
    creatorId ? getFollowerData(creatorId) : { count: null, isFollowing: null, needsFresh: true }
  
  // Initialize local state from cache
  const [followerCount, setLocalFollowerCount] = useState(cachedCount || 0)
  const [isFollowing, setLocalIsFollowing] = useState(cachedIsFollowing || false)
  
  // Function to fetch follower data with request deduplication
  const fetchFollowerData = useCallback(async (force = false) => {
    if (!creatorId || !session?.user) return
    
    // Skip if there's already a pending request for this creator
    // unless we're forcing a refresh
    if (!force && pendingRequests.has(creatorId)) return
    
    // Mark request as pending to prevent duplicates
    addPendingRequest(creatorId)
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/users/${creatorId}/follow`)
      
      if (response.ok) {
        const data = await response.json()
        
        // Update local state
        setLocalFollowerCount(data.followerCount)
        setLocalIsFollowing(data.isFollowing)
        
        // Update global store
        setFollowerCount(creatorId, data.followerCount)
        setFollowingStatus(creatorId, data.isFollowing)
        updateLastFetched(creatorId)
      }
    } catch (error) {
      console.error("Error fetching follower data:", error)
    } finally {
      setIsLoading(false)
      removePendingRequest(creatorId)
    }
  }, [
    creatorId, 
    session?.user, 
    pendingRequests, 
    addPendingRequest, 
    setFollowerCount, 
    setFollowingStatus, 
    updateLastFetched,
    removePendingRequest
  ])
  
  // Function to toggle follow status
  const toggleFollow = useCallback(async () => {
    if (!creatorId || !session?.user) return
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/users/${creatorId}/follow`, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Update local state
        setLocalFollowerCount(data.followerCount)
        setLocalIsFollowing(data.isFollowing)
        
        // Update global store
        setFollowerCount(creatorId, data.followerCount)
        setFollowingStatus(creatorId, data.isFollowing)
        updateLastFetched(creatorId)
        
        return {
          isFollowing: data.isFollowing,
          followerCount: data.followerCount
        }
      }
    } catch (error) {
      console.error("Error toggling follow status:", error)
    } finally {
      setIsLoading(false)
    }
  }, [
    creatorId, 
    session?.user, 
    setFollowerCount, 
    setFollowingStatus, 
    updateLastFetched
  ])
  
  // Initial fetch only if we need fresh data and user is logged in
  useEffect(() => {
    if (creatorId && session?.user && needsFresh) {
      fetchFollowerData()
    }
  }, [creatorId, session?.user, needsFresh, fetchFollowerData])
  
  return {
    isFollowing,
    followerCount,
    isLoading,
    toggleFollow,
    refreshData: () => fetchFollowerData(true)
  }
}