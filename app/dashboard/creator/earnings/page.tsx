"use client"

import { CardFooter } from "@/components/ui/card"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Download,
  TrendingUp,
  DollarSign,
  CreditCard,
  Calendar,
  ArrowUpDown,
  ChevronRight,
  Info,
  TrendingUp as TrendingUpIcon,
} from "lucide-react"
import { useCreatorCourses, useCreatorEarnings } from "@/lib/react-query/queries"
import { BarChart, LineChart } from "../analytics/charts"

export default function EarningsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [timeRange, setTimeRange] = useState("30days")
  const [transactionType, setTransactionType] = useState("all")

  // Fetch courses data
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()
  
  // Fetch earnings data
  const { 
    data: earningsData, 
    isLoading: earningsLoading, 
    error: earningsError 
  } = useCreatorEarnings({
    timeRange: timeRange as any,
    transactionType: transactionType as any
  })

  // Filter transactions based on type (now handled by API)
  const filteredTransactions = earningsData?.transactions || []

  if (status === "loading" || coursesLoading || earningsLoading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading earnings data...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  // Show error state if earnings data failed to load
  if (earningsError) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-500">Failed to load earnings data</p>
          <p className="text-muted-foreground text-sm">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  // Use default values if data is still loading
  const earnings = earningsData || {
    totalEarnings: 0,
    pendingPayouts: 0,
    lastPayout: 0,
    lastPayoutDate: new Date().toISOString(),
    earningsGrowth: 0,
    earningsOverTime: [],
    courseEarnings: [],
    transactions: [],
    metrics: {
      totalSales: 0,
      totalRefunds: 0,
      pendingTransactions: 0,
      conversionRate: "0.00"
    }
  }
  
  // Calculate gross revenue (before platform commission)
  const grossRevenue = earnings.totalEarnings / 0.9;  // Since earnings is 90% of gross

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Earnings & Payouts</h1>
          <p className="text-muted-foreground mt-1">Track your revenue and payment history</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Revenue</CardTitle>
            <div className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-help" title="Total sales before platform commission">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${grossRevenue.toLocaleString()}</div>
                <div className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {earnings.earningsGrowth}% from last period
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Earnings</CardTitle>
            <div className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-help" title="Your earnings after 10% platform commission">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${earnings.totalEarnings.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  After 10% platform commission
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${earnings.pendingPayouts.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Next payout on 1st of month</div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${earnings.lastPayout.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(earnings.lastPayoutDate).toLocaleDateString()}
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">Bank Account</div>
                <div className="text-xs text-muted-foreground mt-1">••••4567</div>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Earnings Over Time</CardTitle>
                  <CardDescription>Monthly earnings trend (after platform fee)</CardDescription>
                </div>
                <div className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-help" title="Shows your earnings after the 10% platform commission">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <LineChart data={earnings.earningsOverTime} xKey="date" yKey="value" color="#10b981" />
              </CardContent>
              <CardFooter className="pt-0">
                <p className="text-xs text-muted-foreground">Values shown are your net earnings after the 10% platform commission</p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Revenue by Course</CardTitle>
                  <CardDescription>Gross revenue breakdown by course</CardDescription>
                </div>
                <div className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-help" title="Shows the total sales amount before platform commission">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <BarChart data={earnings.courseEarnings} xKey="name" yKey="value" color="#8b5cf6" />
              </CardContent>
              <CardFooter className="pt-0 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Values shown are gross revenue before platform commission</p>
                <p className="text-xs font-medium">Your earnings: 90% of these values</p>
              </CardFooter>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your most recent sales and payouts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right" title="Total sale amount">Gross</TableHead>
                    <TableHead className="text-right" title="Your earnings after 10% platform fee">Net (90%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.transactions.slice(0, 5).map((transaction) => {
                    // For sales, calculate both gross and net
                    const isRefund = transaction.type === "refund";
                    const isPayout = transaction.type === "payout";
                    // If it's a payout or refund, show the same amount in both columns
                    const grossAmount = transaction.amount;
                    const netAmount = isPayout ? transaction.amount : transaction.amount * 0.9;
                    
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.type === "sale"
                                ? "default"
                                : transaction.type === "payout"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.course || "—"}</TableCell>
                        <TableCell>{transaction.student || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {isRefund ? "-" : ""}${grossAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {isRefund ? "-" : ""}${netAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("transactions-tab")?.click()}
              >
                View All Transactions
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6" id="transactions-tab">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Complete history of your sales, refunds, and payouts</CardDescription>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="sale">Sales</SelectItem>
                    <SelectItem value="refund">Refunds</SelectItem>
                    <SelectItem value="payout">Payouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transactions found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.type === "sale"
                                ? "default"
                                : transaction.type === "payout"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.course || "—"}</TableCell>
                        <TableCell>{transaction.student || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {transaction.type === "refund" ? "-" : ""}${transaction.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredTransactions.length} of {earnings.transactions.length} transactions
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payout Settings</CardTitle>
              <CardDescription>Manage your payment methods and payout preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Current Payment Method</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Bank Account (Primary)</div>
                      <div className="text-sm text-muted-foreground">••••4567 • Added on Jan 15, 2023</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Payout Schedule</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Monthly</div>
                    <div className="text-sm text-muted-foreground">Payouts are processed on the 1st of each month</div>
                  </div>
                  <Button variant="outline" size="sm">
                    Change
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Payout History</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.transactions
                      .filter((tx) => tx.type === "payout")
                      .map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>{new Date(payout.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>Bank Account (••••4567)</TableCell>
                          <TableCell className="text-right font-medium">${payout.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                Payouts are processed automatically on the 1st of each month for balances over $50. For amounts less
                than $50, the balance will roll over to the next month.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
