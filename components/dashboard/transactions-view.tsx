"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarSync,
  Download,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
type RecurringFrequency = "daily" | "weekly" | "monthly"

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
  category: string
  type: TxType
  amount: number
  frequency: RecurringFrequency
  interval_count: number
  next_run_date: string
  is_active: boolean
}

const CATEGORIES = [
  "Rent/Housing",
  "Bills & Utilities",
  "Food & Groceries",
  "Transportation",
  "Healthcare",
  "Education/Skills",
  "Debt Payments",
  "Savings/Emergency Fund",
  "Entertainment/Fun",
  "Shopping/Misc",
  "Income",
  "Other",
]

type TransactionFormState = {
  id?: number
  type: TxType
  description: string
  amount: string
  category: string
  tx_date: string
}

const INITIAL_TX_FORM: TransactionFormState = {
  type: "expense",
  description: "",
  amount: "",
  category: "Other",
  tx_date: new Date().toISOString().slice(0, 10),
}

type RecurringFormState = {
  id?: number
  type: TxType
  description: string
  amount: string
  category: string
  frequency: RecurringFrequency
  intervalCount: string
  startDate: string
}

const INITIAL_RECURRING_FORM: RecurringFormState = {
  type: "expense",
  description: "",
  amount: "",
  category: "Other",
  frequency: "monthly",
  intervalCount: "1",
  startDate: new Date().toISOString().slice(0, 10),
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function addInterval(date: Date, frequency: RecurringFrequency, intervalCount: number) {
  const next = new Date(date)

  if (frequency === "daily") {
    next.setDate(next.getDate() + intervalCount)
    return next
  }

  if (frequency === "weekly") {
    next.setDate(next.getDate() + intervalCount * 7)
    return next
  }

  next.setMonth(next.getMonth() + intervalCount)
  return next
}

export function TransactionsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | TxType>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const [openTxForm, setOpenTxForm] = useState(false)
  const [openRecurringForm, setOpenRecurringForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [txForm, setTxForm] = useState<TransactionFormState>(INITIAL_TX_FORM)
  const [recurringForm, setRecurringForm] = useState<RecurringFormState>(
    INITIAL_RECURRING_FORM
  )

  const [budgetCategory, setBudgetCategory] = useState("Food & Groceries")
  const [budgetAmount, setBudgetAmount] = useState("")

  const applyRecurringTransactions = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const today = new Date()
    const todayIso = dateToIso(today)

    const { data: dueItems, error: recurringError } = await supabase
      .from("recurring_transactions")
      .select("id, description, category, type, amount, frequency, interval_count, next_run_date")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .lte("next_run_date", todayIso)

    if (recurringError || !dueItems?.length) {
      return
    }

    for (const row of dueItems as Array<{
      id: number
      description: string
      category: string
      type: TxType
      amount: number
      frequency: RecurringFrequency
      interval_count: number
      next_run_date: string
    }>) {
      let runDate = parseIsoDate(row.next_run_date)
      const inserts: Array<{
        user_id: string
        tx_date: string
        description: string
        category: string
        type: TxType
        amount: number
        source: "recurring"
      }> = []

      let guard = 0
      while (runDate <= today && guard < 60) {
        inserts.push({
          user_id: user.id,
          tx_date: dateToIso(runDate),
          description: row.description,
          category: row.category,
          type: row.type,
          amount: Number(row.amount),
          source: "recurring",
        })

        runDate = addInterval(runDate, row.frequency, row.interval_count)
        guard += 1
      }

      if (inserts.length > 0) {
        await supabase.from("transactions").insert(inserts)
      }

      await supabase
        .from("recurring_transactions")
        .update({
          next_run_date: dateToIso(runDate),
          last_generated_on: todayIso,
        })
        .eq("id", row.id)
        .eq("user_id", user.id)
    }
  }, [])

  const loadAll = useCallback(async () => {
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

    await applyRecurringTransactions()

    const [txRes, budgetRes, recurringRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, tx_date, description, category, type, amount")
        .eq("user_id", user.id)
        .order("tx_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("budget_limits")
        .select("id, category, monthly_limit")
        .eq("user_id", user.id),
      supabase
        .from("recurring_transactions")
        .select("id, description, category, type, amount, frequency, interval_count, next_run_date, is_active")
        .eq("user_id", user.id)
        .order("next_run_date", { ascending: true }),
    ])

    if (txRes.error || budgetRes.error || recurringRes.error) {
      setError(txRes.error?.message ?? budgetRes.error?.message ?? recurringRes.error?.message ?? "Failed to load data")
      setIsLoading(false)
      return
    }

    setTransactions((txRes.data as Transaction[]) ?? [])
    setBudgetLimits((budgetRes.data as BudgetLimit[]) ?? [])
    setRecurringItems((recurringRes.data as RecurringTransaction[]) ?? [])
    setIsLoading(false)
  }, [applyRecurringTransactions])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        tx.category.toLowerCase().includes(search.toLowerCase())

      const matchesType = typeFilter === "all" || tx.type === typeFilter
      const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter

      return matchesSearch && matchesType && matchesCategory
    })
  }, [transactions, search, typeFilter, categoryFilter])

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const expenses = filteredTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return {
      income,
      expenses,
      balance: income - expenses,
    }
  }, [filteredTransactions])

  const currentMonth = new Date().toISOString().slice(0, 7)

  const budgetProgressRows = useMemo(() => {
    return budgetLimits.map((limit) => {
      const spent = transactions
        .filter((tx) => {
          return (
            tx.type === "expense" &&
            tx.category === limit.category &&
            tx.tx_date.startsWith(currentMonth)
          )
        })
        .reduce((sum, tx) => sum + Number(tx.amount), 0)

      const percent = limit.monthly_limit > 0 ? (spent / limit.monthly_limit) * 100 : 0

      return {
        ...limit,
        spent,
        percent,
        overBy: Math.max(0, spent - limit.monthly_limit),
      }
    })
  }, [budgetLimits, transactions, currentMonth])

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>(CATEGORIES)

    for (const tx of transactions) {
      unique.add(tx.category)
    }

    for (const limit of budgetLimits) {
      unique.add(limit.category)
    }

    for (const recurring of recurringItems) {
      unique.add(recurring.category)
    }

    return Array.from(unique)
  }, [transactions, budgetLimits, recurringItems])

  const openCreateTxModal = () => {
    setTxForm(INITIAL_TX_FORM)
    setOpenTxForm(true)
  }

  const openEditTxModal = (tx: Transaction) => {
    setTxForm({
      id: tx.id,
      type: tx.type,
      description: tx.description,
      amount: String(tx.amount),
      category: tx.category,
      tx_date: tx.tx_date,
    })
    setOpenTxForm(true)
  }

  const handleDeleteTx = async (id: number) => {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await loadAll()
  }

  const handleSaveTx = async () => {
    setError(null)

    if (!txForm.description.trim()) {
      setError("Description is required.")
      return
    }

    const amount = Number(txForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0.")
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be signed in.")
        return
      }

      if (txForm.id) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            tx_date: txForm.tx_date,
            description: txForm.description.trim(),
            amount,
            category: txForm.category,
            type: txForm.type,
          })
          .eq("id", txForm.id)
          .eq("user_id", user.id)

        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase.from("transactions").insert({
          user_id: user.id,
          tx_date: txForm.tx_date,
          description: txForm.description.trim(),
          amount,
          category: txForm.category,
          type: txForm.type,
          source: "manual",
        })

        if (insertError) {
          setError(insertError.message)
          return
        }
      }

      setOpenTxForm(false)
      setTxForm(INITIAL_TX_FORM)
      await loadAll()
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBudgetLimit = async () => {
    setError(null)

    const amount = Number(budgetAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Budget limit must be greater than 0.")
      return
    }

    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: upsertError } = await supabase
      .from("budget_limits")
      .upsert(
        {
          user_id: user.id,
          category: budgetCategory,
          monthly_limit: amount,
        },
        { onConflict: "user_id,category" }
      )

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setBudgetAmount("")
    await loadAll()
  }

  const openCreateRecurringModal = () => {
    setRecurringForm(INITIAL_RECURRING_FORM)
    setOpenRecurringForm(true)
  }

  const handleSaveRecurring = async () => {
    setError(null)

    if (!recurringForm.description.trim()) {
      setError("Recurring description is required.")
      return
    }

    const amount = Number(recurringForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Recurring amount must be greater than 0.")
      return
    }

    const intervalCount = Number(recurringForm.intervalCount)
    if (!Number.isFinite(intervalCount) || intervalCount < 1) {
      setError("Recurring interval must be at least 1.")
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      if (recurringForm.id) {
        const { error: updateError } = await supabase
          .from("recurring_transactions")
          .update({
            description: recurringForm.description.trim(),
            category: recurringForm.category,
            type: recurringForm.type,
            amount,
            frequency: recurringForm.frequency,
            interval_count: intervalCount,
            start_date: recurringForm.startDate,
            next_run_date: recurringForm.startDate,
          })
          .eq("id", recurringForm.id)
          .eq("user_id", user.id)

        if (updateError) {
          setError(updateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase
          .from("recurring_transactions")
          .insert({
            user_id: user.id,
            description: recurringForm.description.trim(),
            category: recurringForm.category,
            type: recurringForm.type,
            amount,
            frequency: recurringForm.frequency,
            interval_count: intervalCount,
            start_date: recurringForm.startDate,
            next_run_date: recurringForm.startDate,
            is_active: true,
          })

        if (insertError) {
          setError(insertError.message)
          return
        }
      }

      setOpenRecurringForm(false)
      setRecurringForm(INITIAL_RECURRING_FORM)
      await loadAll()
    } finally {
      setIsSaving(false)
    }
  }

  const toggleRecurring = async (item: RecurringTransaction) => {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: updateError } = await supabase
      .from("recurring_transactions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
      .eq("user_id", user.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadAll()
  }

  const deleteRecurring = async (id: number) => {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: deleteError } = await supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await loadAll()
  }

  const exportCsv = () => {
    const header = ["Date", "Description", "Category", "Type", "Amount"]

    const rows = filteredTransactions.map((tx) => [
      tx.tx_date,
      tx.description,
      tx.category,
      tx.type,
      String(tx.amount),
    ])

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "transactions.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Money Planner & Ledger
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Plan category limits first, then track what actually happened.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} className="bg-white/80 dark:bg-slate-900/70">
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button onClick={openCreateRecurringModal} variant="outline" className="bg-white/80 dark:bg-slate-900/70">
            <CalendarSync className="size-4" />
            Add Recurring
          </Button>
          <Button onClick={openCreateTxModal} className="bg-emerald-500 text-white hover:bg-emerald-400">
            <Plus className="size-4" />
            Log Transaction
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Recorded Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-semibold text-emerald-600">{peso.format(totals.income)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredTransactions.filter((tx) => tx.type === "income").length} transactions
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Recorded Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-semibold text-rose-500">{peso.format(totals.expenses)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredTransactions.filter((tx) => tx.type === "expense").length} transactions
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-700 dark:text-slate-300">Recorded Net</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-5xl font-semibold", totals.balance >= 0 ? "text-emerald-600" : "text-rose-500")}>
              {peso.format(totals.balance)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Based on current filters</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Budget Guardrails (Monthly Limits)</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set or adjust category caps and monitor overspending in real time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.filter((category) => category !== "Income").map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monthly Limit (₱)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={budgetAmount}
                onChange={(event) => setBudgetAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void handleSaveBudgetLimit()} className="w-full bg-emerald-500 text-white hover:bg-emerald-400">
                Save Limit
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {budgetProgressRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No category limits set yet.</p>
            ) : (
              budgetProgressRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{row.category}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {peso.format(row.spent)} / {peso.format(row.monthly_limit)} this month
                      </p>
                    </div>
                    {row.percent > 100 ? (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                        <AlertTriangle className="size-3" />
                        Over by {peso.format(row.overBy)}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {Math.min(100, row.percent).toFixed(0)}%
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
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <CalendarSync className="size-4" />
            Automation: Recurring Transactions
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Auto-log salary, rent, bills, and subscriptions on schedule.
          </p>
        </CardHeader>
        <CardContent>
          {recurringItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No recurring transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{peso.format(item.amount)}</TableCell>
                    <TableCell>
                      Every {item.interval_count} {item.frequency}
                    </TableCell>
                    <TableCell>{new Date(item.next_run_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}>
                        {item.is_active ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => void toggleRecurring(item)}>
                          {item.is_active ? <X className="size-4" /> : <ArrowUp className="size-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void deleteRecurring(item.id)}>
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Filter className="size-4" />
            Ledger Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tx-search">Search in Ledger</Label>
            <Input
              id="tx-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description or category..."
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | TxType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/85 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-3xl text-slate-900 dark:text-slate-100">Recorded Transactions (Ledger)</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filteredTransactions.length} transaction(s) found</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading transactions...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.tx_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "rounded-full px-3",
                          tx.type === "expense"
                            ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                        )}
                      >
                        {tx.type === "expense" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                        {tx.type === "expense" ? "Expense" : "Income"}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", tx.type === "expense" ? "text-rose-600" : "text-emerald-600")}>
                      {tx.type === "expense" ? "-" : "+"}{peso.format(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditTxModal(tx)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void handleDeleteTx(tx.id)}>
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={openTxForm} onOpenChange={setOpenTxForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{txForm.id ? "Edit Transaction" : "New Transaction"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-xl border text-sm font-medium",
                    txForm.type === "expense"
                      ? "border-rose-500 bg-rose-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900"
                  )}
                  onClick={() => setTxForm((prev) => ({ ...prev, type: "expense" }))}
                >
                  <ArrowDown className="size-4" />
                  Expense
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-xl border text-sm font-medium",
                    txForm.type === "income"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900"
                  )}
                  onClick={() => setTxForm((prev) => ({ ...prev, type: "income" }))}
                >
                  <ArrowUp className="size-4" />
                  Income
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-description">Title / Description</Label>
              <Input
                id="tx-description"
                value={txForm.description}
                onChange={(event) => setTxForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="e.g. Freelance, Grocery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-amount">Amount (₱)</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0"
                step="0.01"
                value={txForm.amount}
                onChange={(event) => setTxForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={txForm.category} onValueChange={(value) => setTxForm((prev) => ({ ...prev, category: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={txForm.tx_date}
                onChange={(event) => setTxForm((prev) => ({ ...prev, tx_date: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTxForm(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTx()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openRecurringForm} onOpenChange={setOpenRecurringForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{recurringForm.id ? "Edit Recurring" : "New Recurring Transaction"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-xl border text-sm font-medium",
                    recurringForm.type === "expense"
                      ? "border-rose-500 bg-rose-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900"
                  )}
                  onClick={() => setRecurringForm((prev) => ({ ...prev, type: "expense" }))}
                >
                  <ArrowDown className="size-4" />
                  Expense
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-xl border text-sm font-medium",
                    recurringForm.type === "income"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900"
                  )}
                  onClick={() => setRecurringForm((prev) => ({ ...prev, type: "income" }))}
                >
                  <ArrowUp className="size-4" />
                  Income
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={recurringForm.description}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="e.g. Monthly salary"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={recurringForm.amount}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={recurringForm.frequency}
                  onValueChange={(value) => setRecurringForm((prev) => ({ ...prev, frequency: value as RecurringFrequency }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Every (count)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={recurringForm.intervalCount}
                  onChange={(event) => setRecurringForm((prev) => ({ ...prev, intervalCount: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={recurringForm.category}
                  onValueChange={(value) => setRecurringForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={recurringForm.startDate}
                  onChange={(event) => setRecurringForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRecurringForm(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button onClick={() => void handleSaveRecurring()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save Recurring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
