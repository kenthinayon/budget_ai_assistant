import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

type DashboardPageProps = {
  searchParams: Promise<{
    view?: string
  }>
}

const allowedViews = ["dashboard", "transactions", "budget", "history"] as const

type DashboardView = (typeof allowedViews)[number]

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const requestedView = resolvedSearchParams.view
  const activeView: DashboardView = allowedViews.includes(
    requestedView as DashboardView
  )
    ? (requestedView as DashboardView)
    : "dashboard"

  const displayName = user.user_metadata.full_name || user.email || "User"
  const email = user.email || "No email"

  return (
    <DashboardShell
      displayName={displayName}
      email={email}
      activeView={activeView}
    />
  )
}
