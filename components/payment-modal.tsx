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

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseTitle: string
  price: number
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
}: PaymentModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)

  const handlePayment = async () => {
    try {
      setIsLoading(true)

      // Initialize payment
      const response = await fetch("/api/payment/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
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
          description: `Enrollment for ${courseTitle}`,
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
                }),
              })

              const verifyData = await verifyResponse.json()

              if (!verifyResponse.ok) {
                throw new Error(verifyData.error || "Payment verification failed")
              }

              toast.success("Payment successful!")
              onClose()
              router.refresh()
              router.push(`/content/${courseId}/player`)
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
          <DialogTitle>Complete Your Enrollment</DialogTitle>
          <DialogDescription>
            Proceed with the payment to get instant access to the course.
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
              "Pay Now"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
