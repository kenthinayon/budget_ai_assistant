import { createOpenAI } from "@ai-sdk/openai"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

const apiKey = process.env.GROQ_API_KEY

export function getGroqModel() {
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.")
  }

  const groq = createOpenAI({
    baseURL: GROQ_BASE_URL,
    apiKey,
    name: "groq",
  })

  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
  return groq.chat(model)
}
