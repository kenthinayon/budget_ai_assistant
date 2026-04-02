"use client"

import { useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

export function SignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)

    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.replace("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Button
      type="button"
      className="bg-emerald-600 text-white hover:bg-emerald-500"
      disabled={isSigningOut}
      onClick={handleSignOut}
    >
      {isSigningOut ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Signing out...
        </>
      ) : (
        <>
          <LogOut className="size-4" />
          Sign Out
        </>
      )}
    </Button>
  )
}
