import type { EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { getSupabaseServerClient } from "@/lib/supabase/server-client"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null
  const next = requestUrl.searchParams.get("next") ?? "/dashboard"
  const safeNext = next.startsWith("/") ? next : "/dashboard"

  if (!tokenHash || !type) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("notice", "missing_confirmation_token")
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  const redirectUrl = new URL(error ? "/" : safeNext, request.url)

  if (error) {
    redirectUrl.searchParams.set("notice", "email_confirmation_failed")
  } else {
    redirectUrl.searchParams.set("notice", "email_confirmed")
  }

  return NextResponse.redirect(redirectUrl)
}
