"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, Loader2, Mail } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type Notice = {
  type: "success" | "error"
  message: string
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    setIsSubmitting(true)
    setNotice(null)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    })

    setIsSubmitting(false)

    if (error) {
      setNotice({
        type: "error",
        message: error.message,
      })
      return
    }

    setNotice({
      type: "success",
      message: "Password reset link sent. Check your inbox to continue.",
    })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f8fafb_0%,#eef2f5_45%,#e8edef_100%)] p-4 md:p-8">
      <section className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>

        <Card className="border-white/70 bg-white/80 shadow-[0_20px_65px_-35px_rgba(15,23,42,0.4)] backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900">Reset password</CardTitle>
            <CardDescription>
              Enter your account email and we will send a secure reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={isSubmitting || !supabase}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending reset link...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Send reset link
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {notice && (
          <Alert variant={notice.type === "error" ? "destructive" : "default"}>
            <AlertTitle>
              {notice.type === "error" ? "Unable to send reset email" : "Email sent"}
            </AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        )}
      </section>
    </main>
  )
}
