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
} from "lucide-react"
import { useCreatorCourses } from "@/lib/react-query/queries"
import { BarChart, LineChart } from "../analytics/charts"

// Mock earnings data - in a real app, this would come from your API
const mockEarningsData = {
  totalEarnings: 8245.5,
  pendingPayouts: 1250.75,
  lastPayout: 1500.0,
  lastPayoutDate: "2023-10-01T10:00:00Z",
  earningsGrowth: 32,

  // Time series data for charts
  earningsOverTime: [
    { date: "Jan", value: 800 },
    { date: "Feb", value: 1200 },
    { date: "Mar", value: 1800 },
    { date: "Apr", value: 1400 },
    { date: "May", value: 2200 },
    { date: "Jun", value: 2600 },
    { date: "Jul", value: 3200 },
  ],

  courseEarnings: [
    { name: "Web Development", value: 3200 },
    { name: "Data Science", value: 1800 },
    { name: "Mobile App Dev", value: 1400 },
    { name: "UI/UX Design", value: 1200 },
    { name: "Digital Marketing", value: 800 },
  ],

  // Transaction history
  transactions: [
    {
      id: "tx1",
      date: "2023-10-15T14:30:00Z",
      amount: 49.99,
      type: "sale",
      course: "Web Development Bootcamp",
      student: "Alex Johnson",
      status: "completed",
    },
    {
      id: "tx2",
      date: "2023-10-14T09:15:00Z",
      amount: 29.99,
      type: "sale",
      course: "Advanced JavaScript",
      student: "Samantha Lee",
      status: "completed",
    },
    {
      id: "tx3",
      date: "2023-10-12T16:45:00Z",
      amount: 79.99,
      type: "sale",
      course: "Data Science Fundamentals",
      student: "Michael Chen",
      status: "completed",
    },
    {
      id: "tx4",
      date: "2023-10-10T11:20:00Z",
      amount: 1500.0,
      type: "payout",
      course: null,
      student: null,
      status: "completed",
    },
    {
      id: "tx5",
      date: "2023-10-08T13:10:00Z",
      amount: 49.99,
      type: "sale",
      course: "Web Development Bootcamp",
      student: "Emily Rodriguez",
      status: "completed",
    },
    {
      id: "tx6",
      date: "2023-10-05T10:30:00Z",
      amount: 19.99,
      type: "sale",
      course: "UI/UX Design Basics",
      student: "David Kim",
      status: "completed",
    },
    {
      id: "tx7",
      date: "2023-10-03T15:45:00Z",
      amount: 29.99,
      type: "refund",
      course: "Advanced JavaScript",
      student: "Jessica Taylor",
      status: "completed",
    },
    {
      id: "tx8",
      date: "2023-10-01T09:00:00Z",
      amount: 1200.0,
      type: "payout",
      course: null,
      student: null,
      status: "completed",
    },
  ],
}

export default function EarningsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [timeRange, setTimeRange] = useState("30days")
  const [transactionType, setTransactionType] = useState("all")

  // Fetch courses data
  const { data: courses, isLoading: coursesLoading } = useCreatorCourses()

  // Filter transactions based on type
  const filteredTransactions = mockEarningsData.transactions.filter((transaction) => {
    if (transactionType === "all") return true
    return transaction.type === transactionType
  })

  if (status === "loading" || coursesLoading) {
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${mockEarningsData.totalEarnings.toLocaleString()}</div>
                <div className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {mockEarningsData.earningsGrowth}% from last period
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
                <div className="text-2xl font-bold">${mockEarningsData.pendingPayouts.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">${mockEarningsData.lastPayout.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(mockEarningsData.lastPayoutDate).toLocaleDateString()}
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
              <CardHeader>
                <CardTitle>Earnings Over Time</CardTitle>
                <CardDescription>Monthly earnings trend</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <LineChart data={mockEarningsData.earningsOverTime} xKey="date" yKey="value" color="#10b981" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Earnings by Course</CardTitle>
                <CardDescription>Revenue breakdown by course</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <BarChart data={mockEarningsData.courseEarnings} xKey="name" yKey="value" color="#8b5cf6" />
              </CardContent>
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
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockEarningsData.transactions.slice(0, 5).map((transaction) => (
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
                        {transaction.type === "refund" ? "-" : ""}${transaction.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
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
                Showing {filteredTransactions.length} of {mockEarningsData.transactions.length} transactions
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
                    {mockEarningsData.transactions
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
