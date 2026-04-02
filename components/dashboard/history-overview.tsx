"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarRange, TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"

type TxType = "income" | "expense"

type Transaction = {
  id: number
  tx_date: string
  category: string
  type: TxType
  amount: number
}

type BudgetLimit = {
  id: number
  category: string
  monthly_limit: number
}

type MonthStat = {
  key: string
  label: string
  income: number
  expenses: number
  net: number
  savingsRate: number
  overLimitCount: number
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

function monthKeyFromDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-")
  const dt = new Date(Number(year), Number(month) - 1, 1)
  return dt.toLocaleDateString("en-PH", { month: "short", year: "numeric" })
}

export function HistoryOverview() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("You must be signed in.")
      setIsLoading(false)
      return
    }

    const [txRes, budgetRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, tx_date, category, type, amount")
        .eq("user_id", user.id)
        .order("tx_date", { ascending: false })
        .limit(1200),
      supabase
        .from("budget_limits")
        .select("id, category, monthly_limit")
        .eq("user_id", user.id),
    ])

    if (txRes.error || budgetRes.error) {
      setError(txRes.error?.message ?? budgetRes.error?.message ?? "Failed to load history")
      setIsLoading(false)
      return
    }

    setTransactions((txRes.data as Transaction[]) ?? [])
    setBudgetLimits((budgetRes.data as BudgetLimit[]) ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory()
  }, [loadHistory])

  const monthKeys = useMemo(() => {
    const now = new Date()
    const keys: string[] = []

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(monthKeyFromDate(date))
    }

    return keys
  }, [])

  const trendRows = useMemo<MonthStat[]>(() => {
    const limitByCategory = new Map(
      budgetLimits.map((row) => [row.category, Number(row.monthly_limit)])
    )

    return monthKeys.map((key) => {
      const monthTx = transactions.filter((tx) => tx.tx_date.startsWith(key))

      const income = monthTx
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount), 0)

      const expenses = monthTx
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + Number(tx.amount), 0)

      const net = income - expenses
      const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0

      const expenseByCategory = new Map<string, number>()
      for (const tx of monthTx) {
        if (tx.type !== "expense") continue
        expenseByCategory.set(tx.category, (expenseByCategory.get(tx.category) ?? 0) + Number(tx.amount))
      }

      let overLimitCount = 0
      for (const [category, spent] of expenseByCategory) {
        const limit = limitByCategory.get(category)
        if (!limit || limit <= 0) continue
        if (spent > limit) overLimitCount += 1
      }

      return {
        key,
        label: monthLabelFromKey(key),
        income,
        expenses,
        net,
        savingsRate,
        overLimitCount,
      }
    })
  }, [transactions, budgetLimits, monthKeys])

  const currentMonthStat = trendRows[trendRows.length - 1]
  const previousMonthStat = trendRows[trendRows.length - 2]

  const maxTrendValue = useMemo(() => {
    return Math.max(
      1,
      ...trendRows.flatMap((row) => [row.income, row.expenses])
    )
  }, [trendRows])

  const categoryChangeRows = useMemo(() => {
    if (!currentMonthStat || !previousMonthStat) return []

    const currentByCategory = new Map<string, number>()
    const previousByCategory = new Map<string, number>()

    for (const tx of transactions) {
      if (tx.type !== "expense") continue

      if (tx.tx_date.startsWith(currentMonthStat.key)) {
        currentByCategory.set(tx.category, (currentByCategory.get(tx.category) ?? 0) + Number(tx.amount))
      }

      if (tx.tx_date.startsWith(previousMonthStat.key)) {
        previousByCategory.set(tx.category, (previousByCategory.get(tx.category) ?? 0) + Number(tx.amount))
      }
    }

    const categories = new Set<string>([
      ...currentByCategory.keys(),
      ...previousByCategory.keys(),
    ])

    return Array.from(categories)
      .map((category) => {
        const currentAmount = currentByCategory.get(category) ?? 0
        const previousAmount = previousByCategory.get(category) ?? 0
        const change = currentAmount - previousAmount
        const pct = previousAmount > 0 ? (change / previousAmount) * 100 : null

        return {
          category,
          currentAmount,
          previousAmount,
          change,
          pct,
          absChange: Math.abs(change),
        }
      })
      .sort((a, b) => b.absChange - a.absChange)
      .slice(0, 6)
  }, [transactions, currentMonthStat, previousMonthStat])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">This Month Income</CardTitle>
          </CardHeader>
          <CardContent className="text-4xl font-semibold text-emerald-600">
            {isLoading ? "..." : peso.format(currentMonthStat?.income ?? 0)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">This Month Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-4xl font-semibold text-rose-500">
            {isLoading ? "..." : peso.format(currentMonthStat?.expenses ?? 0)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">This Month Net</CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-4xl font-semibold",
              (currentMonthStat?.net ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
            )}
          >
            {isLoading ? "..." : peso.format(currentMonthStat?.net ?? 0)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Savings Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-4xl font-semibold text-cyan-600">
              {isLoading ? "..." : `${currentMonthStat?.savingsRate ?? 0}%`}
            </p>
            <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
              <CalendarRange className="size-3" /> Monthly
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <BarChart3 className="size-4" />
              6-Month Income vs Expenses Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trendRows.map((row) => {
              const incomePct = (row.income / maxTrendValue) * 100
              const expensePct = (row.expenses / maxTrendValue) * 100

              return (
                <div key={row.key} className="space-y-2 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
                    <p className={cn("font-semibold", row.net >= 0 ? "text-emerald-600" : "text-rose-500")}>
                      Net {peso.format(row.net)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Income</span>
                        <span className="text-emerald-600">{peso.format(row.income)}</span>
                      </div>
                      <Progress value={incomePct} className="[&_[data-slot=progress-indicator]]:bg-emerald-500" />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Expenses</span>
                        <span className="text-rose-500">{peso.format(row.expenses)}</span>
                      </div>
                      <Progress value={expensePct} className="[&_[data-slot=progress-indicator]]:bg-rose-500" />
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">Budget Performance Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trendRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 text-sm dark:border-slate-700/70">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{row.overLimitCount} over-limit categories</p>
                </div>
                {row.overLimitCount > 0 ? (
                  <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                    <TrendingDown className="size-3" /> Risk
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <TrendingUp className="size-3" /> Good
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">
            Top Category Changes Month-over-Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryChangeRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Not enough category history yet. Add transactions across multiple months to view change analysis.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>{previousMonthStat?.label ?? "Prev"}</TableHead>
                  <TableHead>{currentMonthStat?.label ?? "Current"}</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryChangeRows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell>{peso.format(row.previousAmount)}</TableCell>
                    <TableCell>{peso.format(row.currentAmount)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", row.change > 0 ? "text-rose-500" : "text-emerald-600")}>
                      {row.change > 0 ? "+" : ""}{peso.format(row.change)}
                      {row.pct !== null ? ` (${row.pct > 0 ? "+" : ""}${row.pct.toFixed(0)}%)` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
