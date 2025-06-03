"use client"

import Link from "next/link"

import type React from "react"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getUserProfile, updateUserProfile } from "@/lib/actions/user"
import { CountryCodeSelect } from "@/components/country-code-select"

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: "",
    bio: "",
    mobileNumber: "",
    twitter: "",
    linkedin: "",
    website: "",
  })

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (status === "authenticated" && session.user.id) {
        setLoading(true)
        try {
          const result = await getUserProfile(session.user.id)

          if (result.success && result.user) {
            setProfileForm({
              name: result.user.name || "",
              bio: result.user.bio || "",
              mobileNumber: result.user.mobileNumber || "",
              twitter: result.user.socialLinks?.twitter || "",
              linkedin: result.user.socialLinks?.linkedin || "",
              website: result.user.socialLinks?.website || "",
            })
          }
        } catch (error) {
          console.error("Error fetching user profile:", error)
        } finally {
          setLoading(false)
        }
      }
    }

    fetchUserProfile()
  }, [session, status])

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setProfileForm({
      ...profileForm,
      [name]: value,
    })
  }

  const handleSaveProfile = async () => {
    if (!session?.user?.id) return

    setSaving(true)
    try {
      const result = await updateUserProfile({
        userId: session.user.id,
        name: profileForm.name,
        bio: profileForm.bio,
        mobileNumber: profileForm.mobileNumber,
        socialLinks: {
          twitter: profileForm.twitter,
          linkedin: profileForm.linkedin,
          website: profileForm.website,
        },
      })

      if (result.success) {
        toast({
          title: "Success",
          description: "Your profile has been updated successfully",
        })
      } else {
        throw new Error(result.error || "Failed to update profile")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p className="mb-6">Please sign in to access your settings.</p>
        <Button asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile information and how others see you on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User"} />
                    <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">
                    Profile image is managed by your authentication provider
                  </p>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileFormChange}
                      placeholder="Your name"
                    />
                  </div>

                  <CountryCodeSelect
                    value={profileForm.mobileNumber}
                    onChange={(value) => setProfileForm({ ...profileForm, mobileNumber: value })}
                    label="Mobile Number"
                    placeholder="Phone Number"
                    helperText="Select your country code and enter your number"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={profileForm.bio}
                      onChange={handleProfileFormChange}
                      placeholder="Tell us about yourself"
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      name="twitter"
                      value={profileForm.twitter}
                      onChange={handleProfileFormChange}
                      placeholder="https://twitter.com/username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      name="linkedin"
                      value={profileForm.linkedin}
                      onChange={handleProfileFormChange}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      value={profileForm.website}
                      onChange={handleProfileFormChange}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={session?.user?.email || ""} disabled />
                  <Button variant="outline" disabled>
                    Change
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Email is managed by your authentication provider</p>
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <div className="flex items-center gap-2">
                  <Input value={session?.user?.role || "STUDENT"} disabled />
                  <Button variant="outline" disabled>
                    Change
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Contact support to change your account type</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">Notification settings coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
