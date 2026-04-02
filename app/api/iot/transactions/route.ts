import { NextResponse } from "next/server"

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client"

type IotTransactionPayload = {
  userId?: string
  amount?: number
  description?: string
  category?: string
  type?: "income" | "expense"
  date?: string
  deviceId?: string
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function POST(request: Request) {
  const configuredToken = process.env.IOT_INGEST_TOKEN

  if (!configuredToken) {
    return NextResponse.json(
      { error: "Missing IOT_INGEST_TOKEN on server." },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  const providedToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null

  if (!providedToken || providedToken !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as IotTransactionPayload

  if (!body.userId || !body.description || !body.category || !body.type) {
    return NextResponse.json(
      { error: "userId, description, category, and type are required." },
      { status: 400 }
    )
  }

  if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number." },
      { status: 400 }
    )
  }

  if (body.type !== "income" && body.type !== "expense") {
    return NextResponse.json(
      { error: "type must be income or expense." },
      { status: 400 }
    )
  }

  const txDate = body.date && isValidIsoDate(body.date)
    ? body.date
    : new Date().toISOString().slice(0, 10)

  const supabase = getSupabaseServiceRoleClient()

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: body.userId,
      tx_date: txDate,
      description: body.description,
      category: body.category,
      type: body.type,
      amount: body.amount,
      source: "iot",
      device_id: body.deviceId ?? null,
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
