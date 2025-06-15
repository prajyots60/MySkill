import React, { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { usePaymentEvents } from "@/hooks/use-payment-events"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseTitle: string
  price: number
  isRenewal?: boolean
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export function PaymentModal({
  isOpen,
  onClose,
  courseId,
  courseTitle,
  price,
  isRenewal = false,
}: PaymentModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const { notifyPaymentSuccess } = usePaymentEvents()

  const handlePayment = async () => {
    try {
      setIsLoading(true)

      // Initialize payment
      const response = await fetch("/api/payment/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, isRenewal }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Payment initialization failed")
      }

      // Load Razorpay script
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      document.body.appendChild(script)

      script.onload = () => {
        const options = {
          key: data.key,
          amount: data.amount,
          currency: data.currency,
          name: "EduPlatform",
          description: isRenewal ? `Renewal for ${courseTitle}` : `Enrollment for ${courseTitle}`,
          order_id: data.orderId,
          handler: async function (response: any) {
            try {
              // Verify payment
              const verifyResponse = await fetch("/api/payment/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  courseId,
                  isRenewal,
                }),
              })

              const verifyData = await verifyResponse.json()

              if (!verifyResponse.ok) {
                throw new Error(verifyData.error || "Payment verification failed")
              }

              toast.success(isRenewal ? "Course access renewed successfully!" : "Payment successful!")
              
              // Double check enrollment status from server with cache busting
              try {
                const timestamp = new Date().getTime();
                // Force an enrollment check explicitly after payment
                await fetch(`/api/courses/${courseId}/enrollment-status?t=${timestamp}`, {
                  cache: 'no-store',
                  headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                  }
                });
              } catch (checkError) {
                console.error("Error double checking enrollment:", checkError);
                // Continue even if this fails as notifyPaymentSuccess will trigger UI update
              }
              
              // Notify the system about successful payment
              notifyPaymentSuccess(courseId)
              
              // First refresh the UI
              router.refresh()
              
              // Give the system a moment to process the payment
              setTimeout(() => {
                // Close modal after a slight delay to avoid jarring transition
                onClose()
                
                // Wait a bit longer before navigating to ensure state is updated
                setTimeout(() => {
                  // Force a reload to ensure fresh data
                  window.location.href = `/content/${courseId}/player`;
                }, 500)
              }, 300)
            } catch (error) {
              console.error("Payment verification error:", error)
              toast.error("Payment verification failed. Please contact support.")
            }
          },
          prefill: {
            name: "",
            email: "",
            contact: "",
          },
          theme: {
            color: "#0066FF",
          },
        }

        const razorpayInstance = new window.Razorpay(options)
        razorpayInstance.open()
      }

      script.onerror = () => {
        toast.error("Failed to load payment gateway")
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Payment error:", error)
      toast.error("Failed to initialize payment")
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      // Cleanup Razorpay script when component unmounts
      const script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
      if (script) {
        document.body.removeChild(script)
      }
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isRenewal ? "Renew Course Access" : "Complete Your Enrollment"}</DialogTitle>
          <DialogDescription>
            {isRenewal 
              ? "Proceed with the payment to renew your access to this course." 
              : "Proceed with the payment to get instant access to the course."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2 px-2">
            <p className="text-sm font-medium">Course</p>
            <p className="text-sm text-muted-foreground">{courseTitle}</p>
          </div>
          <div className="space-y-2 px-2">
            <p className="text-sm font-medium">Amount</p>
            <p className="text-xl font-bold">
              ₹{price.toLocaleString("en-IN")}
            </p>
          </div>
          <Button
            onClick={handlePayment}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              isRenewal ? "Renew Access" : "Pay Now"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
