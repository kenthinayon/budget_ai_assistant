"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, PiggyBank, TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"

type TxType = "income" | "expense"

type Transaction = {
  id: number
  tx_date: string
  description: string
  category: string
  type: TxType
  amount: number
}

type BudgetLimit = {
  id: number
  category: string
  monthly_limit: number
}

type RecurringTransaction = {
  id: number
  description: string
  type: TxType
  amount: number
  next_run_date: string
  is_active: boolean
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

export function DashboardOverview() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
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

    const [txRes, budgetRes, recurringRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, tx_date, description, category, type, amount")
        .eq("user_id", user.id)
        .order("tx_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("budget_limits")
        .select("id, category, monthly_limit")
        .eq("user_id", user.id),
      supabase
        .from("recurring_transactions")
        .select("id, description, type, amount, next_run_date, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("next_run_date", { ascending: true })
        .limit(8),
    ])

    if (txRes.error || budgetRes.error || recurringRes.error) {
      setError(txRes.error?.message ?? budgetRes.error?.message ?? recurringRes.error?.message ?? "Failed to load dashboard data")
      setIsLoading(false)
      return
    }

    setTransactions((txRes.data as Transaction[]) ?? [])
    setBudgetLimits((budgetRes.data as BudgetLimit[]) ?? [])
    setRecurringItems((recurringRes.data as RecurringTransaction[]) ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOverview()
  }, [loadOverview])

  const currentMonth = new Date().toISOString().slice(0, 7)

  const monthlyMetrics = useMemo(() => {
    const monthTransactions = transactions.filter((tx) => tx.tx_date.startsWith(currentMonth))

    const income = monthTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const expenses = monthTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const net = income - expenses
    const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0

    return {
      income,
      expenses,
      net,
      savingsRate,
      txCount: monthTransactions.length,
    }
  }, [transactions, currentMonth])

  const budgetRiskRows = useMemo(() => {
    const rows = budgetLimits.map((limit) => {
      const spent = transactions
        .filter((tx) => tx.type === "expense" && tx.category === limit.category && tx.tx_date.startsWith(currentMonth))
        .reduce((sum, tx) => sum + Number(tx.amount), 0)

      const percent = limit.monthly_limit > 0 ? (spent / limit.monthly_limit) * 100 : 0
      return {
        ...limit,
        spent,
        percent,
        overBy: Math.max(0, spent - limit.monthly_limit),
      }
    })

    return rows.sort((a, b) => b.percent - a.percent)
  }, [budgetLimits, transactions, currentMonth])

  const budgetHealth = useMemo(() => {
    if (budgetRiskRows.length === 0) return null

    const overCount = budgetRiskRows.filter((row) => row.percent > 100).length
    const nearCount = budgetRiskRows.filter((row) => row.percent >= 80 && row.percent <= 100).length

    return Math.max(0, 100 - overCount * 25 - nearCount * 10)
  }, [budgetRiskRows])

  const nextAction = useMemo(() => {
    const topRisk = budgetRiskRows[0]

    if (!topRisk) {
      return "Set your first category budget in Budget to unlock alerts and guidance."
    }

    if (topRisk.percent > 100) {
      return `Reduce ${topRisk.category} spending this week. You are over by ${peso.format(topRisk.overBy)}.`
    }

    if (topRisk.percent >= 80) {
      return `Watch ${topRisk.category}. You already used ${Math.round(topRisk.percent)}% of this month's limit.`
    }

    if (monthlyMetrics.savingsRate < 20) {
      return "Savings rate is below 20%. Consider trimming one non-essential category this week."
    }

    return "Good pacing this month. Keep recurring transactions accurate and review limits every 2 weeks."
  }, [budgetRiskRows, monthlyMetrics.savingsRate])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Income This Month</CardTitle>
          </CardHeader>
          <CardContent className="text-4xl font-semibold text-emerald-600">
            {isLoading ? "..." : peso.format(monthlyMetrics.income)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Expenses This Month</CardTitle>
          </CardHeader>
          <CardContent className="text-4xl font-semibold text-rose-500">
            {isLoading ? "..." : peso.format(monthlyMetrics.expenses)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Net This Month</CardTitle>
          </CardHeader>
          <CardContent className={cn("text-4xl font-semibold", monthlyMetrics.net >= 0 ? "text-emerald-600" : "text-rose-500")}>
            {isLoading ? "..." : peso.format(monthlyMetrics.net)}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Savings Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-4xl font-semibold text-cyan-600">{isLoading ? "..." : `${monthlyMetrics.savingsRate}%`}</p>
            <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
              <TrendingUp className="size-3" />
              Monthly
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Budget Health</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-4xl font-semibold text-emerald-600">
              {isLoading ? "..." : budgetHealth === null ? "--" : `${budgetHealth}%`}
            </p>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <PiggyBank className="size-3" />
              Live
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">Budget Risk Watch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading budget signals...</p>
            ) : budgetRiskRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No budget limits found. Add limits in Budget to activate this section.</p>
            ) : (
              budgetRiskRows.slice(0, 5).map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{row.category}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {peso.format(row.spent)} / {peso.format(row.monthly_limit)}
                      </p>
                    </div>
                    {row.percent > 100 ? (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        <AlertTriangle className="size-3" /> Over limit
                      </Badge>
                    ) : row.percent >= 80 ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Near limit
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        On track
                      </Badge>
                    )}
                  </div>
                  <Progress
                    value={Math.min(100, row.percent)}
                    className={cn(row.percent > 100 && "[&_[data-slot=progress-indicator]]:bg-rose-500")}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">Smart Next Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-3 text-sm text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-900/20 dark:text-cyan-100">
              {isLoading ? "Analyzing your budget behavior..." : nextAction}
            </p>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex items-center gap-2"><TrendingUp className="size-4 text-emerald-500" /> Income entries this month: {isLoading ? "..." : transactions.filter((tx) => tx.type === "income" && tx.tx_date.startsWith(currentMonth)).length}</p>
              <p className="flex items-center gap-2"><TrendingDown className="size-4 text-rose-500" /> Expense entries this month: {isLoading ? "..." : transactions.filter((tx) => tx.type === "expense" && tx.tx_date.startsWith(currentMonth)).length}</p>
            </div>

            <div className="grid gap-2">
              <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-400">
                <Link href="/dashboard?view=transactions">Log Transaction</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard?view=budget">Review Budget Limits</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <CalendarClock className="size-4" />
            Upcoming Recurring Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading recurring schedule...</p>
          ) : recurringItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No active recurring transactions yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {recurringItems.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{item.description}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.type === "income" ? "Income" : "Expense"} • {peso.format(item.amount)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Next run: {new Date(item.next_run_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
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
