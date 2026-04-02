"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  BotMessageSquare,
  History,
  Loader2,
  PiggyBank,
  ReceiptText,
  LogIn,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type Notice = {
  type: "success" | "error"
  title: string
  message: string
}

const appName = "BudgetWise AI"

export function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next")

  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const hasConfigError = !supabase

  const [activeTab, setActiveTab] = useState("signin")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInitializing, setIsInitializing] = useState(!hasConfigError)

  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")

  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("")
  const [signUpAge, setSignUpAge] = useState("")
  const [signUpPhone, setSignUpPhone] = useState("")
  const [signUpSex, setSignUpSex] = useState("")

  const redirectAfterAuth = useMemo(() => {
    if (nextPath && nextPath.startsWith("/")) {
      return nextPath
    }

    return "/dashboard"
  }, [nextPath])

  useEffect(() => {
    if (!supabase) {
      return
    }

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace(redirectAfterAuth)
        return
      }

      setIsInitializing(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace(redirectAfterAuth)
      }
    })

    return () => subscription.unsubscribe()
  }, [redirectAfterAuth, router, supabase])

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    setIsSubmitting(true)
    setNotice(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    })

    setIsSubmitting(false)

    if (error) {
      setNotice({
        type: "error",
        title: "Sign in failed",
        message: error.message,
      })
      return
    }

    router.replace(redirectAfterAuth)
    router.refresh()
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    const normalizedPhone = signUpPhone.trim()
    const parsedAge = Number(signUpAge)

    if (signUpPassword !== signUpConfirmPassword) {
      setNotice({
        type: "error",
        title: "Sign up failed",
        message: "Password and confirm password must match.",
      })
      return
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setNotice({
        type: "error",
        title: "Sign up failed",
        message: "Age must be a valid number between 1 and 120.",
      })
      return
    }

    if (!/^[0-9+()\-\s]{7,20}$/.test(normalizedPhone)) {
      setNotice({
        type: "error",
        title: "Sign up failed",
        message: "Enter a valid phone number.",
      })
      return
    }

    setIsSubmitting(true)
    setNotice(null)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(
          redirectAfterAuth
        )}`,
        data: {
          full_name: signUpName,
          age: parsedAge,
          phone: normalizedPhone,
          sex: signUpSex,
        },
      },
    })

    setIsSubmitting(false)

    if (error) {
      setNotice({
        type: "error",
        title: "Sign up failed",
        message: error.message,
      })
      return
    }

    setNotice({
      type: "success",
      title: "Check your inbox",
      message:
        "We sent a confirmation email. Confirm your account, then continue to your dashboard.",
    })
    setActiveTab("signin")
    setSignInEmail(signUpEmail)
    setSignInPassword("")
    setSignUpPassword("")
    setSignUpConfirmPassword("")
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f8fafb_0%,#eef2f5_45%,#e8edef_100%)] p-4 md:p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-20 h-56 w-56 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-cyan-100/45 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-md space-y-5">
        <div className="space-y-3 text-center mb-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
            <PiggyBank className="size-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 pt-2">
            Welcome to {appName}
          </h1>
          <p className="text-[15px] text-slate-500">
            Smart budgeting powered by artificial intelligence
          </p>
        </div>

        <Card className="border-white/70 bg-white/80 shadow-[0_20px_65px_-35px_rgba(15,23,42,0.4)] backdrop-blur">
          {isInitializing ? (
            <CardContent className="py-14">
              <div className="flex items-center justify-center gap-2 text-slate-600">
                <Loader2 className="size-4 animate-spin" />
                Preparing secure session...
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl text-slate-900">Secure Access</CardTitle>
                <CardDescription className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Sign in or create your account to continue.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100/85">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form className="space-y-4" onSubmit={handleSignIn}>
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={signInEmail}
                          onChange={(event) => setSignInEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={signInPassword}
                          onChange={(event) => setSignInPassword(event.target.value)}
                          placeholder="Enter your password"
                          className="h-11"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Link
                          href="/auth/forgot-password"
                          className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <Button
                        type="submit"
                        className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={isSubmitting || hasConfigError}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <LogIn className="size-4" />
                            Sign In
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form className="space-y-4" onSubmit={handleSignUp}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          autoComplete="name"
                          required
                          value={signUpName}
                          onChange={(event) => setSignUpName(event.target.value)}
                          placeholder="Your full name"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={signUpEmail}
                          onChange={(event) => setSignUpEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="h-11"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="signup-age">Age</Label>
                          <Input
                            id="signup-age"
                            type="number"
                            min={1}
                            max={120}
                            required
                            value={signUpAge}
                            onChange={(event) => setSignUpAge(event.target.value)}
                            placeholder="25"
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-sex">Sex</Label>
                          <select
                            id="signup-sex"
                            required
                            value={signUpSex}
                            onChange={(event) => setSignUpSex(event.target.value)}
                            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <option value="" disabled>
                              Select
                            </option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Phone number</Label>
                        <Input
                          id="signup-phone"
                          type="tel"
                          autoComplete="tel"
                          required
                          value={signUpPhone}
                          onChange={(event) => setSignUpPhone(event.target.value)}
                          placeholder="+1 555 000 1234"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={signUpPassword}
                          onChange={(event) => setSignUpPassword(event.target.value)}
                          placeholder="At least 6 characters"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm-password">Confirm password</Label>
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={signUpConfirmPassword}
                          onChange={(event) =>
                            setSignUpConfirmPassword(event.target.value)
                          }
                          placeholder="Re-enter your password"
                          className="h-11"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={isSubmitting || hasConfigError}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-4" />
                            Create Account
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>

        {(hasConfigError || notice) && (
          <Alert
            variant={
              hasConfigError || notice?.type === "error"
                ? "destructive"
                : "default"
            }
          >
            <AlertTitle>
              {hasConfigError ? "Configuration required" : notice?.title}
            </AlertTitle>
            <AlertDescription>
              {hasConfigError
                ? "Missing Supabase public environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
                : notice?.message}
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-white/70 bg-white/65 shadow-[0_20px_65px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">After login</CardTitle>
            <CardDescription>
              Clean sidebar navigation and an AI chatbox for fast budgeting support.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2 py-2 text-xs font-medium text-slate-700">
                <LayoutDashboard className="size-3.5 text-emerald-600" />
                Dashboard
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2 py-2 text-xs font-medium text-slate-700">
                <ReceiptText className="size-3.5 text-emerald-600" />
                Transactions
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2 py-2 text-xs font-medium text-slate-700">
                <PiggyBank className="size-3.5 text-emerald-600" />
                Budget
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2 py-2 text-xs font-medium text-slate-700">
                <History className="size-3.5 text-emerald-600" />
                History
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-800">
              <div className="flex items-center gap-2">
                <BotMessageSquare className="size-4" />
                AI chatbox ready after sign-in
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-emerald-700">
                Live helper
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
