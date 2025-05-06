"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, CreditCard, Shield, Star } from "lucide-react"
import Link from "next/link"

export default function PaidCoursePage() {
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Premium Course Access</CardTitle>
            <CardDescription className="text-lg">Unlock full access to this premium course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-6 w-6 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Full Course Access</h3>
                  <p className="text-muted-foreground">
                    Get unlimited access to all course materials, including videos, exercises, and resources.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Star className="h-6 w-6 text-amber-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Certificate of Completion</h3>
                  <p className="text-muted-foreground">
                    Earn a certificate upon completing the course to showcase your skills.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Shield className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Lifetime Access</h3>
                  <p className="text-muted-foreground">
                    Access the course materials anytime, anywhere, with lifetime access.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="flex-1 gap-2">
                <CreditCard className="h-5 w-5" />
                Enroll Now
              </Button>
              <Button variant="outline" size="lg" className="flex-1" asChild>
                <Link href="/explore">Browse Free Courses</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
