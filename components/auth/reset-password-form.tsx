"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, Lock } from "lucide-react"

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

export function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    const prepareSession = async () => {
      const { data } = await supabase.auth.getSession()
      setIsReady(Boolean(data.session))
    }

    prepareSession()
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    if (password !== confirmPassword) {
      setNotice({
        type: "error",
        message: "Passwords do not match.",
      })
      return
    }

    setIsSubmitting(true)
    setNotice(null)

    const { error } = await supabase.auth.updateUser({
      password,
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
      message: "Password updated successfully. You can now sign in with your new password.",
    })
    setPassword("")
    setConfirmPassword("")
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
            <CardTitle className="text-2xl text-slate-900">Set new password</CardTitle>
            <CardDescription>
              Choose a strong new password to secure your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={isSubmitting || !isReady || !supabase}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    Update password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {!isReady && (
          <Alert variant="destructive">
            <AlertTitle>Reset session required</AlertTitle>
            <AlertDescription>
              Open this page from the reset link sent to your email so we can verify your recovery session.
            </AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant={notice.type === "error" ? "destructive" : "default"}>
            <AlertTitle>
              {notice.type === "error" ? "Unable to update password" : "Password updated"}
            </AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              {notice.type === "success" && <CheckCircle2 className="size-4 text-emerald-600" />}
              {notice.message}
            </AlertDescription>
          </Alert>
        )}
      </section>
    </main>
  )
}
