"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import type { Comment } from "@/lib/types"

interface LectureCommentsProps {
  lectureId: string
}

export function LectureComments({ lectureId }: LectureCommentsProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/lectures/${lectureId}/comments`)

        if (!response.ok) {
          throw new Error("Failed to fetch comments")
        }

        const data = await response.json()
        setComments(data.comments || [])
      } catch (error) {
        console.error("Error fetching comments:", error)
        toast({
          title: "Error",
          description: "Failed to load comments",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (lectureId) {
      fetchComments()
    }
  }, [lectureId, toast])

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return

    try {
      setSubmitting(true)

      const response = await fetch(`/api/lectures/${lectureId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: commentText }),
      })

      if (!response.ok) {
        throw new Error("Failed to post comment")
      }

      const data = await response.json()

      // Add the new comment to the list
      setComments((prev) => [data.comment, ...prev])
      setCommentText("")

      toast({
        title: "Success",
        description: "Comment posted successfully",
      })
    } catch (error) {
      console.error("Error posting comment:", error)
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim()) return

    try {
      setSubmitting(true)

      const response = await fetch(`/api/lectures/${lectureId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: replyText,
          parentId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to post reply")
      }

      const data = await response.json()

      // Add the reply to the parent comment
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), data.comment],
            }
          }
          return comment
        }),
      )

      setReplyText("")
      setReplyTo(null)

      toast({
        title: "Success",
        description: "Reply posted successfully",
      })
    } catch (error) {
      console.error("Error posting reply:", error)
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discussion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {session ? (
          <div className="flex gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
              <AvatarFallback>{session.user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex justify-end">
                <Button onClick={handleSubmitComment} disabled={!commentText.trim() || submitting}>
                  {submitting ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">Please sign in to join the discussion</p>
          </div>
        )}

        <div className="space-y-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-4">
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={comment.user?.image || ""} alt={comment.user?.name || "User"} />
                    <AvatarFallback>{comment.user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{comment.user?.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1">{comment.text}</p>
                    {session && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      >
                        Reply
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reply form */}
                {replyTo === comment.id && session && (
                  <div className="flex gap-4 ml-14">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                      <AvatarFallback>{session.user?.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder={`Reply to ${comment.user?.name}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyTo(null)
                            setReplyText("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyText.trim() || submitting}
                        >
                          {submitting ? "Posting..." : "Reply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-14 space-y-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-4">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={reply.user?.image || ""} alt={reply.user?.name || "User"} />
                          <AvatarFallback>{reply.user?.name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{reply.user?.name}</h4>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="mt-1">{reply.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No comments yet. Be the first to start the discussion!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
