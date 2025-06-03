// Types for creator earnings data

export interface EarningsTransaction {
  id: string
  date: string
  amount: number
  type: "sale" | "refund" | "pending" | "payout" | "failed"
  course: string | null
  student: string | null
  status: string
}

export interface EarningsChartData {
  date: string
  value: number
}

export interface CourseEarningsData {
  name: string
  value: number
}

export interface EarningsMetrics {
  totalSales: number
  totalRefunds: number
  pendingTransactions: number
  conversionRate: string
}

export interface EarningsData {
  totalEarnings: number
  pendingPayouts: number
  lastPayout: number
  lastPayoutDate: string
  earningsGrowth: number
  earningsOverTime: EarningsChartData[]
  courseEarnings: CourseEarningsData[]
  transactions: EarningsTransaction[]
  metrics: EarningsMetrics
}

export interface EarningsQueryParams {
  timeRange?: "7days" | "30days" | "90days" | "year" | "all"
  transactionType?: "all" | "sale" | "refund" | "pending"
}
