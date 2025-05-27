"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Info, Loader2 } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(false)
  
  // Improve error handling with more user-friendly messages
  const errorType = searchParams.get("error")
  const [error, setError] = useState<{message: string, isWarning?: boolean} | null>(
    errorType === "OAuthAccountNotLinked"
      ? {
          message: "It looks like you've previously signed up with a different method. Please use your original sign-in method.",
          isWarning: true
        }
      : errorType ? { message: errorType } : null
  )

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard/student"

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Explicitly set redirect to true to ensure client-side redirect happens
      // This is crucial for properly transitioning to authenticated pages
      const result = await signIn("google", { 
        callbackUrl,
        redirect: true,
      })
      
      // This code will only run if redirect:true fails for some reason
      if (!result?.ok) {
        setError({ message: "Authentication failed. Please try again." })
        toast({
          title: "Error",
          description: `Authentication error: ${result?.error || 'Unknown error'}`,
          variant: "destructive",
        })
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Sign-in error:", error)
      setError({ message: "Failed to sign in with Google. Please try again." })
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 px-4 py-12">
      <Card className="w-full max-w-md border-indigo-700/50 bg-slate-900/90 backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">Sign in</CardTitle>
          <CardDescription className="text-slate-300">Sign in to your account to access your courses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert 
              variant={error.isWarning ? "default" : "destructive"} 
              className={error.isWarning 
                ? "bg-amber-900/20 border-amber-800 text-amber-100" 
                : "bg-red-900/20 border-red-800"}
            >
              {error.isWarning ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle className={error.isWarning ? "text-amber-100" : ""}>
                {error.isWarning ? "Important Information" : "Error"}
              </AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
              {error.isWarning && (
                <div className="mt-2 text-sm">
                  If you can't remember how you signed up, please contact support for assistance.
                </div>
              )}
            </Alert>
          )}

          <Button
            variant="outline"
            className="w-full bg-slate-800 text-white border-indigo-700/50 hover:bg-indigo-900/50 hover:text-white flex items-center justify-center gap-2 h-11"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FcGoogle className="h-5 w-5" />}
            <span>Sign in with Google</span>
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-indigo-700/50" />
            </div>
          </div>
          <p className="text-sm text-center text-slate-300">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-indigo-400 underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
