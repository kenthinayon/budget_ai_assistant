"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { Bot, Maximize2, Minimize2, Send, Trash2, User, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function ChatBox({ onClose }: { onClose?: () => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [input, setInput] = useState("")
  const [historyError, setHistoryError] = useState<string | null>(null)
  const hasLoadedHistoryRef = useRef(false)
  const lastPersistedSignatureRef = useRef("")

  const { messages, sendMessage, setMessages, status, error } = useChat<UIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    messages: [],
  })

  const quickQuestions = [
    "How is my budget looking?",
    "Explain the 50/30/20 rule",
    "How can I save more?",
    "Analyze my food spending",
  ]

  useEffect(() => {
    let isCancelled = false

    const loadHistory = async () => {
      try {
        const response = await fetch("/api/chat/history", {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null

          throw new Error(body?.error ?? "Failed to load chat history")
        }

        const body = (await response.json()) as {
          messages?: Array<{
            id: string
            role: "assistant" | "user"
            content: string
          }>
        }

        const loadedMessages: UIMessage[] = (body.messages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          parts: [{ type: "text", text: message.content }],
        }))

        if (!isCancelled) {
          setMessages(loadedMessages)
          setHistoryError(null)
          hasLoadedHistoryRef.current = true
        }
      } catch (error) {
        if (!isCancelled) {
          setHistoryError(
            error instanceof Error ? error.message : "Failed to load chat history"
          )
          hasLoadedHistoryRef.current = true
        }
      }
    }

    loadHistory()

    return () => {
      isCancelled = true
    }
  }, [setMessages])

  useEffect(() => {
    if (!hasLoadedHistoryRef.current) return

    const serializableMessages = messages
      .filter((message) => message.role === "assistant" || message.role === "user")
      .map((message) => {
        const content = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
          .trim()

        return {
          id: message.id,
          role: message.role,
          content,
        }
      })
      .filter((message) => message.content.length > 0)

    const signature = JSON.stringify(serializableMessages)

    if (signature === lastPersistedSignatureRef.current) {
      return
    }

    lastPersistedSignatureRef.current = signature

    const persistHistory = async () => {
      const response = await fetch("/api/chat/history", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: serializableMessages }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null

        setHistoryError(body?.error ?? "Failed to save chat history")
      }
    }

    void persistHistory()
  }, [messages])

  const handleQuickQuestion = (q: string) => setInput(q)

  const handleClearChat = async () => {
    setMessages([])
    lastPersistedSignatureRef.current = JSON.stringify([])

    const response = await fetch("/api/chat/history", {
      method: "DELETE",
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      setHistoryError(body?.error ?? "Failed to clear chat history")
      return
    }

    setHistoryError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || status !== "ready") return

    setInput("")
    await sendMessage({ text })
  }

  return (
    <div
      className={cn(
        "flex flex-col border border-slate-200 bg-white shadow-xl transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-950",
        isFullscreen
          ? "fixed inset-4 z-50 rounded-2xl md:inset-10"
          : "fixed bottom-5 right-5 z-40 h-[600px] w-[min(92vw,400px)] rounded-2xl"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Bot className="size-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              Kent AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Your personal financial advisor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 mr-2">
            <div className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-600">Online</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => void handleClearChat()}
            title="Clear chat"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-slate-600"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-4 pb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-3 text-sm",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-slate-100 dark:bg-slate-800" : "bg-emerald-500 text-white"
                )}
              >
                {m.role === "user" ? <User className="size-4 text-slate-600 dark:text-slate-300" /> : <Bot className="size-4" />}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 max-w-[85%]",
                  m.role === "user"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100"
                )}
              >
                <div className="prose prose-sm prose-emerald max-w-none dark:prose-invert whitespace-pre-wrap">
                  {m.parts
                    .filter((part) => part.type === "text")
                    .map((part, index) => (
                      <p key={`${m.id}-${index}`}>{part.text}</p>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        {historyError && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {historyError}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error.message}
          </div>
        )}

        {status !== "ready" && (
          <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">Kent AI is thinking...</div>
        )}

        {messages.length < 3 && (
          <div className="mb-4">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask me anything about your finances..."
            className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 pr-12 text-sm placeholder:text-slate-400 focus-visible:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || status !== "ready"}
            className="absolute right-2 top-2 size-8 rounded-lg bg-emerald-400 text-white hover:bg-emerald-500 transition-colors"
          >
            <Send className="size-4" />
          </Button>
        </form>
        <p className="mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Press Enter to send • Shift + Enter for new line
        </p>
      </div>
    </div>
  )
}
