import { streamText, type ModelMessage, type UIMessage } from "ai"

import { getGroqModel } from "@/lib/ai/groq-client"
import { KENT_SYSTEM_PROMPT } from "@/lib/ai/kent-system-prompt"

export const dynamic = "force-dynamic"

type ChatRequestBody = {
  messages?: UIMessage[]
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
        normalized.push({ role: "assistant", content: text })
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody
    const messages = body.messages

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

    const result = streamText({
      model: getGroqModel(),
      system: KENT_SYSTEM_PROMPT,
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
