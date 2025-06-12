"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function EarningsLoading() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(index => (
          <Card key={index} className="bg-gradient-to-br from-primary/5 via-primary/10 to-background relative overflow-hidden">
            <div className="absolute inset-0 shimmer"></div>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="overview" disabled className="opacity-50">Overview</TabsTrigger>
          <TabsTrigger value="transactions" disabled className="opacity-50">Transactions</TabsTrigger>
          <TabsTrigger value="payouts" disabled className="opacity-50">Payouts</TabsTrigger>
        </TabsList>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart cards */}
            {[1, 2].map(index => (
              <Card key={index} className="relative overflow-hidden">
                <div className="absolute inset-0 shimmer"></div>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-md" />
                </CardContent>
                <CardFooter className="pt-0">
                  <Skeleton className="h-4 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Recent Transactions */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 shimmer"></div>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Skeleton className="h-5 w-16" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-16" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5].map(index => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        </div>
      </Tabs>
    </div>
  )
}
