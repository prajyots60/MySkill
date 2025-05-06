"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil, User, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { completeUserOnboarding, updateUserSession } from "@/lib/actions/auth"
import type { UserRole } from "@/lib/types"
import { getRedirectPathForRole } from "@/lib/utils/roles"

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status, update } = useSession()
  const { toast } = useToast()

  const [selectedRole, setSelectedRole] = useState<UserRole>("STUDENT")
  const [bio, setBio] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get userId from query params if available
  const userId = searchParams.get("userId") || session?.user?.id
  const isNew = searchParams.get("isNew") === "true"

  // Redirect if already onboarded
  useEffect(() => {
    if (status === "authenticated" && session.user.onboarded) {
      const redirectPath = getRedirectPathForRole(session.user.role as UserRole)
      router.push(redirectPath)
    }
  }, [status, session, router])

  // Redirect if not authenticated and no userId in query
  useEffect(() => {
    if (status === "unauthenticated" && !userId) {
      router.push("/auth/signin")
    }
  }, [status, userId, router])

  // Update the handleSubmit function to properly update the session and redirect
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!userId) {
      setError("User ID not found. Please try signing in again.")
      toast({
        title: "Error",
        description: "User ID not found. Please try signing in again.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      console.log("Completing onboarding for user:", userId)
      const result = await completeUserOnboarding({
        userId,
        role: selectedRole,
        bio,
      })

      if (result.success) {
        console.log("Onboarding successful, updating session")
        // Update the session with the new role and onboarded status
        await update({
          user: {
            role: selectedRole,
            onboarded: true,
          },
        })

        // Force a session revalidation
        if (session?.user?.id) {
          await updateUserSession({
            userId: session.user.id,
            role: selectedRole,
            onboarded: true,
          })
        }

        toast({
          title: "Success",
          description: result.isNew
            ? "Your account has been created successfully!"
            : "Your profile has been updated successfully!",
        })

        // Redirect based on role
        const redirectPath = getRedirectPathForRole(selectedRole)
        console.log("Redirecting to:", redirectPath)
        router.push(redirectPath)
      } else {
        throw new Error(result.error || "Failed to update profile")
      }
    } catch (error) {
      console.error("Onboarding error:", error)
      setError(error instanceof Error ? error.message : "Failed to update profile")
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
          <p className="text-white">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-indigo-700/50 bg-slate-900/90 backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-indigo-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center">
            <Video className="h-8 w-8 text-indigo-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Welcome to EduTube!
          </CardTitle>
          <CardDescription className="text-slate-300">Tell us a bit about yourself to get started</CardDescription>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-md text-sm mt-4">
              {error}
            </div>
          )}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-200">I want to join as a:</h3>
              <RadioGroup
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as UserRole)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2 rounded-md border border-indigo-700/50 p-4 hover:bg-indigo-900/30 transition-colors">
                  <RadioGroupItem value="STUDENT" id="student" className="text-indigo-400" />
                  <Label htmlFor="student" className="flex-1 cursor-pointer text-slate-200">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-indigo-400" />
                      <div>
                        <div className="font-medium">Student</div>
                        <div className="text-sm text-slate-400">I want to learn and take courses</div>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-indigo-700/50 p-4 hover:bg-indigo-900/30 transition-colors">
                  <RadioGroupItem value="CREATOR" id="creator" className="text-indigo-400" />
                  <Label htmlFor="creator" className="flex-1 cursor-pointer text-slate-200">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-5 w-5 text-indigo-400" />
                      <div>
                        <div className="font-medium">Creator</div>
                        <div className="text-sm text-slate-400">I want to create and sell courses</div>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-slate-200">
                Bio (Optional)
              </Label>
              <Textarea
                id="bio"
                placeholder="Tell us a bit about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="resize-none bg-slate-800/50 border-indigo-700/50 text-slate-200 placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400">This will be displayed on your public profile</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
