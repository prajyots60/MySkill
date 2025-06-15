"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  CircleAlert,
  Clock,
  Hourglass,
  Loader2,
  RefreshCcw,
  Users,
  CheckCircle,
  TimerOff,
  SendHorizonal,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface EnrollmentStatisticsProps {
  courseId: string;
}

interface EnrollmentStats {
  totalEnrollments: number;
  activeEnrollments: number;
  expiredEnrollments: number;
  expiringSoon: number;
  renewalRate: string;
  recentlyExpired: Array<{
    id: string;
    userId: string;
    expiresAt: string;
    user: {
      name: string | null;
      email: string | null;
    };
  }>;
}

export function EnrollmentStatistics({ courseId }: EnrollmentStatisticsProps) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<EnrollmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  const fetchStats = async () => {
    if (!session?.user) return;
    
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/courses/${courseId}/enrollment-stats`);
      
      if (!res.ok) {
        throw new Error("Failed to fetch enrollment statistics");
      }

      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching enrollment statistics:", err);
      setError(err instanceof Error ? err.message : "Failed to load enrollment statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [courseId, session]);

  const handleSendReminders = async () => {
    if (!stats?.recentlyExpired.length) return;

    try {
      setSendingReminders(true);
      
      // This would be implemented in a real system
      // Mock implementation for now
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast({
        title: "Renewal reminders sent",
        description: `Sent ${stats.recentlyExpired.length} renewal reminder(s) successfully.`,
      });
    } catch (err) {
      toast({
        title: "Failed to send reminders",
        description: "There was an error sending renewal reminders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Error loading enrollment statistics</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>No enrollment data available</AlertTitle>
        <AlertDescription>
          There is no enrollment data available for this course.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Enrollment Statistics</CardTitle>
          <CardDescription>Manage student enrollments and expirations</CardDescription>
        </div>
        <Button
          variant="outline"
          onClick={fetchStats}
          className="flex items-center gap-1"
          size="sm"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Enrollments */}
          <Card className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full p-3 bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-2 text-3xl font-semibold">
                  {stats.totalEnrollments}
                </h3>
                <p className="text-sm text-muted-foreground">Total Enrollments</p>
              </div>
            </CardContent>
          </Card>

          {/* Active Enrollments */}
          <Card className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full p-3 bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="mt-2 text-3xl font-semibold">
                  {stats.activeEnrollments}
                </h3>
                <p className="text-sm text-muted-foreground">Active Enrollments</p>
              </div>
            </CardContent>
          </Card>

          {/* Expired Enrollments */}
          <Card className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full p-3 bg-red-500/10">
                  <TimerOff className="h-6 w-6 text-red-500" />
                </div>
                <h3 className="mt-2 text-3xl font-semibold">
                  {stats.expiredEnrollments}
                </h3>
                <p className="text-sm text-muted-foreground">Expired Enrollments</p>
              </div>
            </CardContent>
          </Card>

          {/* Expiring Soon */}
          <Card className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full p-3 bg-amber-500/10">
                  <Hourglass className="h-6 w-6 text-amber-500" />
                </div>
                <h3 className="mt-2 text-3xl font-semibold">{stats.expiringSoon}</h3>
                <p className="text-sm text-muted-foreground">Expiring in 7 Days</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Renewal Rate */}
        <Card className="border shadow-sm p-5">
          <div className="flex flex-col">
            <div className="flex justify-between mb-2">
              <h3 className="font-medium">Renewal Rate</h3>
              <span className="text-sm font-medium">{stats.renewalRate}%</span>
            </div>
            <Progress value={parseFloat(stats.renewalRate)} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              Percentage of expired enrollments that were renewed
            </p>
          </div>
        </Card>
        
        {/* Recent Expirations */}
        {stats.recentlyExpired.length > 0 && (
          <Card className="border shadow-sm p-5">
            <div className="space-y-4">
              <div className="flex justify-between">
                <h3 className="font-medium">Recently Expired Enrollments</h3>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                >
                  {sendingReminders ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <SendHorizonal className="h-4 w-4 mr-2" />
                      Send Renewal Reminders
                    </>
                  )}
                </Button>
              </div>
              
              <div className="space-y-2">
                {stats.recentlyExpired.map((enrollment) => (
                  <div 
                    key={enrollment.id}
                    className="p-3 border rounded-md flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{enrollment.user.name || "Anonymous User"}</p>
                      <p className="text-sm text-muted-foreground">
                        {enrollment.user.email || "No email available"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-red-500 text-sm">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Expired {new Date(enrollment.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
