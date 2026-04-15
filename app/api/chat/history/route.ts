import { NextResponse } from "next/server"

import { sanitizeAiText } from "@/lib/ai/response-cleaner"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

type ChatHistoryRequestBody = {
  messages?: Array<{
    id: string
    role: "user" | "assistant"
    content: string
  }>
}

type PostgrestLikeError = {
  code?: string
  message?: string
}

function isMissingChatMessagesTable(error: PostgrestLikeError | null) {
  // Postgres undefined_table
  return error?.code === "42P01"
}

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("message_id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200)

  if (isMissingChatMessagesTable(error)) {
    // Allow chat to keep working even if migration has not been applied yet.
    return NextResponse.json({ messages: [] })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    messages: (data ?? []).map((message) => ({
      id: message.message_id,
      role: message.role,
      content:
        message.role === "assistant"
          ? sanitizeAiText(message.content)
          : message.content,
    })),
  })
}

export async function PUT(request: Request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as ChatHistoryRequestBody
  const incomingMessages = body.messages ?? []

  if (!Array.isArray(incomingMessages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 })
  }

  const rows = incomingMessages
    .map((message) => ({
      user_id: user.id,
      message_id: message.id,
      role: message.role,
      content: message.content,
    }))
    .filter((message) => {
      return (
        typeof message.message_id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      )
    })
    .map((message) => ({
      ...message,
      content:
        message.role === "assistant"
          ? sanitizeAiText(message.content)
          : message.content,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from("chat_messages")
    .upsert(rows, { onConflict: "user_id,message_id" })

  if (isMissingChatMessagesTable(error)) {
    return NextResponse.json({ ok: true })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", user.id)

  if (isMissingChatMessagesTable(error)) {
    return NextResponse.json({ ok: true })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
