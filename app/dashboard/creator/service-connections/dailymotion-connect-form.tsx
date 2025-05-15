"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
})

export function DailymotionConnectForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
      apiSecret: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true)

      // Store credentials and initiate OAuth flow
      const response = await fetch("/api/dailymotion/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        throw new Error("Failed to initiate Dailymotion connection")
      }

      const data = await response.json()
      
      // Redirect to Dailymotion authorization page
      window.location.href = data.authorizationUrl
    } catch (error) {
      console.error("Error connecting to Dailymotion:", error)
      toast({
        title: "Error",
        description: "Failed to connect to Dailymotion. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dailymotion API Key</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your Dailymotion API Key"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your Dailymotion API Key from the developer dashboard
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dailymotion API Secret</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your Dailymotion API Secret"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your Dailymotion API Secret from the developer dashboard
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Connect to Dailymotion
        </Button>
      </form>
    </Form>
  )
} 