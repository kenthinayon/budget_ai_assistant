import { streamText, type ModelMessage, type UIMessage } from "ai"

import { getGroqModel } from "@/lib/ai/groq-client"
import { KENT_SYSTEM_PROMPT } from "@/lib/ai/kent-system-prompt"
import { sanitizeAiText } from "@/lib/ai/response-cleaner"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

export const dynamic = "force-dynamic"

type ChatRequestBody = {
  messages?: UIMessage[]
  analysisMode?: "aggregate" | "deep"
}

type TxType = "income" | "expense"

type TransactionRow = {
  tx_date: string
  description: string
  category: string
  type: TxType
  amount: number
}

type BudgetLimitRow = {
  category: string
  monthly_limit: number
}

type RecurringRow = {
  description: string
  category: string
  type: TxType
  amount: number
  frequency: string
  interval_count: number
  next_run_date: string
  is_active: boolean
}

function toGroqMessages(messages: UIMessage[]): ModelMessage[] {
  const normalized: ModelMessage[] = []

  for (const message of messages) {
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()

      if (!text) continue

      if (message.role === "assistant") {
        normalized.push({ role: "assistant", content: sanitizeAiText(text) })
        continue
      }

      if (message.role === "system") {
        normalized.push({ role: "system", content: text })
        continue
      }

      normalized.push({ role: "user", content: text })
  }

  return normalized
}

function monthKey(dateValue: string) {
  return dateValue.slice(0, 7)
}

async function buildFinancialContext(userId: string, mode: "aggregate" | "deep") {
  const supabase = await getSupabaseServerClient()

  const txLimit = mode === "deep" ? 300 : 600
  const [txRes, budgetRes, recurringRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("tx_date, description, category, type, amount")
      .eq("user_id", userId)
      .order("tx_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(txLimit),
    supabase
      .from("budget_limits")
      .select("category, monthly_limit")
      .eq("user_id", userId),
    supabase
      .from("recurring_transactions")
      .select("description, category, type, amount, frequency, interval_count, next_run_date, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("next_run_date", { ascending: true })
      .limit(20),
  ])

  if (txRes.error || budgetRes.error || recurringRes.error) {
    return "Financial context unavailable due to a temporary data retrieval issue."
  }

  const transactions = (txRes.data as TransactionRow[]) ?? []
  const limits = (budgetRes.data as BudgetLimitRow[]) ?? []
  const recurring = (recurringRes.data as RecurringRow[]) ?? []

  const monthly = new Map<string, { income: number; expense: number }>()
  const expenseByCategory = new Map<string, number>()

  for (const tx of transactions) {
    const month = monthKey(tx.tx_date)
    const entry = monthly.get(month) ?? { income: 0, expense: 0 }

    if (tx.type === "income") {
      entry.income += Number(tx.amount)
    } else {
      entry.expense += Number(tx.amount)
      expenseByCategory.set(
        tx.category,
        (expenseByCategory.get(tx.category) ?? 0) + Number(tx.amount)
      )
    }

    monthly.set(month, entry)
  }

  const monthLines = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, value]) => {
      const net = value.income - value.expense
      return `${key}: income=${value.income.toFixed(2)}, expense=${value.expense.toFixed(2)}, net=${net.toFixed(2)}`
    })

  const topCategories = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount]) => `${category}=${amount.toFixed(2)}`)

  const limitLines = limits.map(
    (row) => `${row.category}: monthly_limit=${Number(row.monthly_limit).toFixed(2)}`
  )

  const recurringLines = recurring.map(
    (row) => `${row.description} (${row.category}) ${row.type} ${Number(row.amount).toFixed(2)} next=${row.next_run_date} every ${row.interval_count} ${row.frequency}`
  )

  if (mode === "aggregate") {
    return [
      "ANALYSIS MODE: AGGREGATE (safe summary-only)",
      "Use this context to give personalized advice using summarized data, not per-transaction forensic detail.",
      `Recent monthly summary: ${monthLines.join(" | ") || "none"}`,
      `Top expense categories: ${topCategories.join(" | ") || "none"}`,
      `Budget limits: ${limitLines.join(" | ") || "none"}`,
      `Active recurring: ${recurringLines.join(" | ") || "none"}`,
    ].join("\n")
  }

  const recentTransactions = transactions
    .slice(0, 80)
    .map(
      (tx) =>
        `${tx.tx_date} | ${tx.type} | ${tx.category} | ${Number(tx.amount).toFixed(2)} | ${tx.description}`
    )

  return [
    "ANALYSIS MODE: DEEP (full transaction pattern analysis)",
    "You may reference recurring patterns, anomalies, and category behavior from individual rows.",
    `Recent monthly summary: ${monthLines.join(" | ") || "none"}`,
    `Top expense categories: ${topCategories.join(" | ") || "none"}`,
    `Budget limits: ${limitLines.join(" | ") || "none"}`,
    `Active recurring: ${recurringLines.join(" | ") || "none"}`,
    "Recent transactions sample:",
    ...recentTransactions,
  ].join("\n")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody
    const messages = body.messages
    const analysisMode = body.analysisMode === "deep" ? "deep" : "aggregate"

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Invalid request body: messages array is required." },
        { status: 400 }
      )
    }

    const modelMessages = toGroqMessages(messages)

    if (modelMessages.length === 0) {
      return Response.json(
        { error: "Please enter a message before sending." },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const financialContext = await buildFinancialContext(user.id, analysisMode)

    const result = streamText({
      model: getGroqModel(),
      system: `${KENT_SYSTEM_PROMPT}\n\n${financialContext}`,
      messages: modelMessages,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown chat error"

    return Response.json(
      { error: `Chat route failed: ${message}` },
      { status: 500 }
    )
  }
}
