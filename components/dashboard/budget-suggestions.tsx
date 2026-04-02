"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

const STARTER_BUDGET_RANGES: Array<{
  category: string
  minPercent: number
  maxPercent: number
}> = [
  { category: "Bills & Utilities", minPercent: 25, maxPercent: 35 },
  { category: "Food & Groceries", minPercent: 10, maxPercent: 15 },
  { category: "Transportation", minPercent: 8, maxPercent: 12 },
  { category: "Rent/Housing", minPercent: 20, maxPercent: 30 },
  { category: "Healthcare", minPercent: 5, maxPercent: 8 },
  { category: "Education/Skills", minPercent: 3, maxPercent: 7 },
  { category: "Debt Payments", minPercent: 5, maxPercent: 15 },
  { category: "Savings/Emergency Fund", minPercent: 10, maxPercent: 20 },
  { category: "Entertainment/Fun", minPercent: 3, maxPercent: 8 },
  { category: "Shopping/Misc", minPercent: 3, maxPercent: 7 },
]

export function BudgetSuggestions() {
  const [starterIncome, setStarterIncome] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleApplyStarterBudget = async () => {
    setError(null)
    setMessage(null)

    const income = Number(starterIncome)
    if (!Number.isFinite(income) || income <= 0) {
      setError("Monthly take-home income must be greater than 0.")
      return
    }

    setIsApplying(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be signed in.")
        return
      }

      const payload = STARTER_BUDGET_RANGES.map((item) => {
        const midpointPercent = (item.minPercent + item.maxPercent) / 2
        const monthlyLimit = Math.round((income * midpointPercent) / 100)

        return {
          user_id: user.id,
          category: item.category,
          monthly_limit: monthlyLimit,
        }
      })

      const { error: upsertError } = await supabase
        .from("budget_limits")
        .upsert(payload, { onConflict: "user_id,category" })

      if (upsertError) {
        setError(upsertError.message)
        return
      }

      setMessage("Starter limits applied to your Budget Guardrails.")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-slate-100">Starter Budget Plan</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Use your monthly take-home income to auto-fill suggested category limits.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Monthly Take-Home Income (PHP)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={starterIncome}
              onChange={(event) => setStarterIncome(event.target.value)}
              placeholder="e.g. 30000"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => void handleApplyStarterBudget()}
              disabled={isApplying}
              className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
            >
              {isApplying ? "Applying..." : "Apply Starter Limits"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-slate-200/70 p-3 text-sm dark:border-slate-700/70 md:grid-cols-2">
          {STARTER_BUDGET_RANGES.map((item) => (
            <div key={item.category} className="flex items-center justify-between gap-3">
              <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.minPercent}% to {item.maxPercent}%
              </Badge>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
            <p className="text-xs uppercase tracking-wide text-slate-500">Quick Rule</p>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">Needs: around 50% to 60%</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
            <p className="text-xs uppercase tracking-wide text-slate-500">Quick Rule</p>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">Savings + debt goals: around 20% to 30%</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
            <p className="text-xs uppercase tracking-wide text-slate-500">Quick Rule</p>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">Wants: around 20%</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          Example at PHP 30,000 take-home: Needs PHP 16,500, Savings + debt PHP 7,500, Wants PHP 6,000.
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200/70 p-3 text-sm dark:border-slate-700/70">
          <p className="font-medium text-slate-900 dark:text-slate-100">Best first setup in your tracker</p>
          <p className="text-slate-600 dark:text-slate-400">1. Put hard limits first on Food, Transportation, Entertainment, and Shopping.</p>
          <p className="text-slate-600 dark:text-slate-400">2. Keep Bills as a planned fixed amount.</p>
          <p className="text-slate-600 dark:text-slate-400">3. Add an Emergency Fund line, even if only PHP 1,000 to 2,000 monthly.</p>
          <p className="text-slate-600 dark:text-slate-400">4. Review every 2 weeks and adjust by actual spending.</p>
        </div>

        {message && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-300">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
