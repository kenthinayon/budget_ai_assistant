"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import {
  BotMessageSquare,
  ChevronsLeft,
  ChevronsRight,
  History,
  LayoutDashboard,
  Menu,
  PiggyBank,
  ReceiptText,
  X,
} from "lucide-react"

import { ProfileMenu } from "@/components/dashboard/profile-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ChatBox = dynamic(
  () => import("@/components/dashboard/chat-box").then((mod) => mod.ChatBox),
  {
    ssr: false,
  }
)

const DashboardOverview = dynamic(
  () =>
    import("@/components/dashboard/dashboard-overview").then(
      (mod) => mod.DashboardOverview
    ),
  {
    loading: () => <SectionLoadingFallback />,
  }
)

const TransactionsView = dynamic(
  () => import("./transactions-view").then((mod) => mod.TransactionsView),
  {
    loading: () => <SectionLoadingFallback />,
  }
)

const BudgetSuggestions = dynamic(
  () =>
    import("@/components/dashboard/budget-suggestions").then(
      (mod) => mod.BudgetSuggestions
    ),
  {
    loading: () => <SectionLoadingFallback />,
  }
)

const HistoryOverview = dynamic(
  () =>
    import("@/components/dashboard/history-overview").then(
      (mod) => mod.HistoryOverview
    ),
  {
    loading: () => <SectionLoadingFallback />,
  }
)

type DashboardView = "dashboard" | "transactions" | "budget" | "history"

type DashboardShellProps = {
  displayName: string
  email: string
  activeView: DashboardView
}

const menuItems: Array<{
  key: DashboardView
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "transactions", label: "Transactions", icon: ReceiptText },
  { key: "budget", label: "Budget", icon: PiggyBank },
  { key: "history", label: "History", icon: History },
]

function SectionLoadingFallback() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
      Loading section...
    </div>
  )
}

export function DashboardShell({
  displayName,
  email,
  activeView,
}: DashboardShellProps) {
  const [currentView, setCurrentView] = useState<DashboardView>(activeView)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    setCurrentView(activeView)
  }, [activeView])

  const handleViewChange = (nextView: DashboardView) => {
    setCurrentView(nextView)
    setIsSidebarOpen(false)

    const url = new URL(window.location.href)
    url.searchParams.set("view", nextView)
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`)
  }

  const sectionTitle = useMemo(() => {
    if (currentView === "transactions") return "Transactions"
    if (currentView === "budget") return "Budget"
    if (currentView === "history") return "History"
    return "Financial Dashboard"
  }, [currentView])

  const sectionDescription = useMemo(() => {
    if (currentView === "transactions") {
      return "Track income and expenses with clean transaction records."
    }
    if (currentView === "budget") {
      return "Get starter guidance and set budget limits that fit your real income."
    }
    if (currentView === "history") {
      return "Review your past performance and recurring patterns."
    }
    return "AI-powered insights and budget tracking"
  }, [currentView])

  const renderContent = () => {
    if (currentView === "transactions") {
      return <TransactionsView />
    }

    if (currentView === "budget") {
      return <BudgetSuggestions />
    }

    if (currentView === "history") {
      return <HistoryOverview />
    }

    return <DashboardOverview />
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f8fafb_0%,#eef2f5_45%,#e8edef_100%)] text-slate-900 dark:bg-[linear-gradient(135deg,#0b1220_0%,#111827_45%,#0f172a_100%)] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-20 h-56 w-56 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/30" />
        <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-cyan-100/45 blur-3xl dark:bg-cyan-900/25" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/70 bg-white/85 p-5 backdrop-blur transition-all duration-200 lg:static lg:translate-x-0 dark:border-slate-700/70 dark:bg-slate-950/70",
            isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <PiggyBank className="size-5" />
              </div>
              <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
                <p className="truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">BudgetWise AI</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Smart Budgeting</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="size-4" />
            </Button>
          </div>

          <nav className="mt-8 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleViewChange(item.key)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex h-12 items-center rounded-xl text-sm font-medium transition",
                    isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4",
                    isActive
                      ? "bg-emerald-500 text-white shadow-[0_12px_24px_-16px_rgba(16,185,129,0.8)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
                  )}
                >
                  <Icon className="size-4" />
                  <span className={cn(isSidebarCollapsed && "lg:hidden")}>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto pt-8">
            <ProfileMenu
              displayName={displayName}
              email={email}
              isCollapsed={isSidebarCollapsed}
            />
          </div>
        </aside>

        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
        )}

        <section className="flex-1 p-4 md:p-6 lg:p-8">
          {currentView !== "transactions" && (
            <header className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="bg-white/85 lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden bg-white/85 lg:inline-flex"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isSidebarCollapsed ? (
                    <ChevronsRight className="size-4" />
                  ) : (
                    <ChevronsLeft className="size-4" />
                  )}
                </Button>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                    {sectionTitle}
                  </h1>
                  <p className="text-slate-600">{sectionDescription}</p>
                </div>
              </div>
            </header>
          )}

          {currentView === "transactions" && (
            <div className="mb-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-white/85 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden bg-white/85 lg:inline-flex"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </Button>
            </div>
          )}

          {renderContent()}
        </section>
      </div>

      {isChatOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/30"
          onClick={() => setIsChatOpen(false)}
          aria-label="Close chat overlay"
        />
      )}

      <div className="fixed right-5 bottom-5 z-40">
        {isChatOpen && <ChatBox onClose={() => setIsChatOpen(false)} />}

        <Button
          type="button"
          size="icon"
          className="size-14 rounded-full bg-emerald-500 text-white shadow-[0_18px_28px_-16px_rgba(16,185,129,0.8)] hover:bg-emerald-400"
          onClick={() => setIsChatOpen((prev) => !prev)}
          aria-label="Toggle AI chat"
        >
          {isChatOpen ? <X className="size-5" /> : <BotMessageSquare className="size-5" />}
        </Button>
      </div>
    </main>
  )
}
