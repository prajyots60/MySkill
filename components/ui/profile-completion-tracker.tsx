"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink, AlertCircle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

// Fields required for public profile view
const REQUIRED_FIELDS = [
  { key: 'name', label: 'Display Name' },
  { key: 'bio', label: 'Bio' },
  { key: 'expertise', label: 'Areas of Expertise', validator: (value: any) => Array.isArray(value) && value.length > 0 },
  { key: 'tagline', label: 'Tagline' },
  { key: 'coverImages', label: 'Cover Image', validator: (value: any) => Array.isArray(value) && value[0]?.length > 0 },
  { key: 'yearsTeaching', label: 'Years of Teaching Experience' },
  { key: 'categories', label: 'Teaching Categories', validator: (value: any) => Array.isArray(value) && value.length > 0 }
]

export interface ProfileCompletionTrackerProps {
  profile: Record<string, any> | null
  className?: string
  forDashboard?: boolean
}

export function ProfileCompletionTracker({
  profile,
  className,
  forDashboard = false
}: ProfileCompletionTrackerProps) {
  // Get user session to access the user ID
  const { data: session } = useSession();
  
  // Calculate the profile completion metrics
  const {
    completionPercentage,
    missingRequiredFields,
    isComplete
  } = useMemo(() => {
    if (!profile) {
      return { 
        completionPercentage: 0, 
        missingRequiredFields: REQUIRED_FIELDS,
        isComplete: false
      }
    }

    const completedFields = REQUIRED_FIELDS.filter(field => {
      if (field.validator) {
        return field.validator(profile[field.key])
      }
      
      if (Array.isArray(profile[field.key])) {
        return profile[field.key].length > 0
      }
      
      return profile[field.key] && String(profile[field.key]).trim() !== ''
    })
    
    const missingFields = REQUIRED_FIELDS.filter(field => 
      !completedFields.some(f => f.key === field.key)
    )
    
    const percentage = Math.round((completedFields.length / REQUIRED_FIELDS.length) * 100)

    return {
      completionPercentage: percentage,
      missingRequiredFields: missingFields,
      isComplete: missingFields.length === 0
    }
  }, [profile])

  // Dashboard compact version
  if (forDashboard) {
    return (
      <div className={cn("bg-white rounded-md border p-4", className)}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-lg">Profile Completion</h3>
                <p className="text-gray-500">{missingRequiredFields.length} required fields remaining</p>
              </div>
            </div>
          </div>
          
          <div>
            <span className="text-lg font-semibold">{completionPercentage}%</span>
          </div>
        </div>
        
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/dashboard/creator/settings">
              Complete Profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Settings page version
  return (
    <div className={cn("bg-white rounded-md p-6", className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-100 p-4 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Profile Completion</h2>
          <p className="text-gray-500">Complete your profile to unlock all creator features</p>
        </div>
        <span className="text-2xl font-semibold ml-auto">{completionPercentage}%</span>
      </div>
      
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 rounded-full"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      
      {!isComplete && (
        <div className="mt-6 bg-amber-50 border border-amber-100 rounded-md p-4">
          <div className="flex items-center gap-2 mb-3 text-amber-800">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Required fields to complete:</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            {missingRequiredFields.map((field) => (
              <div key={field.key} className="flex items-center gap-2 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{field.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-6 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/dashboard/creator/settings">
            Complete Profile
          </Link>
        </Button>
        
        <Button 
          asChild={isComplete}
          variant="outline" 
          disabled={!isComplete}
          className="gap-1.5"
        >
          {isComplete ? (
            <Link href={`/creators/${session?.user?.id}`} className="flex items-center gap-1.5">
              View Public Profile
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5">
              View Public Profile
              <ExternalLink className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}