"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Camera,
  Loader2,
  LogOut,
  Moon,
  Settings,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"

type ProfileMenuProps = {
  displayName: string
  email: string
  isCollapsed?: boolean
}

export function ProfileMenu({ displayName, email, isCollapsed = false }: ProfileMenuProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [openSettings, setOpenSettings] = useState(false)
  const [fullName, setFullName] = useState(displayName)
  const [emailAddress, setEmailAddress] = useState(email)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const initials = useMemo(() => {
    const trimmed = fullName.trim() || displayName.trim()
    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
    }
    return (parts[0]?.[0] ?? "U").toUpperCase()
  }, [displayName, fullName])

  useEffect(() => {
    let isCancelled = false

    const loadProfile = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || isCancelled) return

        setEmailAddress(user.email ?? email)

        const metadataName = user.user_metadata?.full_name
        if (typeof metadataName === "string" && metadataName.trim()) {
          setFullName(metadataName)
        }

        const metadataAvatar = user.user_metadata?.avatar_url
        if (typeof metadataAvatar === "string" && metadataAvatar.trim()) {
          setAvatarUrl(metadataAvatar)
        }

        const { data } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle()

        if (isCancelled || !data) return

        if (data.full_name && data.full_name.trim()) {
          setFullName(data.full_name)
        }

        if (data.avatar_url && data.avatar_url.trim()) {
          setAvatarUrl(data.avatar_url)
        }
      } catch {
        // Keep menu functional even if profile fetch fails.
      }
    }

    loadProfile()

    return () => {
      isCancelled = true
    }
  }, [email])

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

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setErrorMessage("Only JPG or PNG files are allowed.")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Image must be 2MB or less.")
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarUrl(previewUrl)
    setSelectedAvatarFile(file)
    setErrorMessage(null)
  }

  const handleSaveSettings = async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    if (newPassword && newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.")
      return
    }

    setIsSaving(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage("You are not authenticated.")
        return
      }

      let nextAvatarUrl = avatarUrl

      if (selectedAvatarFile) {
        const fileExt = selectedAvatarFile.name.split(".").pop() || "jpg"
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedAvatarFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: selectedAvatarFile.type,
          })

        if (uploadError) {
          setErrorMessage(
            "Avatar upload failed. Make sure avatars bucket and policies are created in Supabase."
          )
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath)

        nextAvatarUrl = publicUrlData.publicUrl
      }

      const cleanedName = fullName.trim()

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: cleanedName || null,
          avatar_url: nextAvatarUrl || null,
        },
        ...(newPassword ? { password: newPassword } : {}),
      })

      if (metadataError) {
        setErrorMessage(metadataError.message)
        return
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: cleanedName || null,
          avatar_url: nextAvatarUrl || null,
        },
        { onConflict: "id" }
      )

      if (profileError) {
        setStatusMessage(
          "Changes saved to account metadata. Run database migrations to sync profiles table fully."
        )
      } else {
        setStatusMessage("Profile updated successfully.")
      }

      setAvatarUrl(nextAvatarUrl)
      setSelectedAvatarFile(null)
      setNewPassword("")
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  const isDarkMode = theme === "dark"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full rounded-2xl border border-slate-200/80 bg-slate-100/80 p-3 text-left hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-900",
              isCollapsed && "flex justify-center"
            )}
          >
            <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
              <Avatar className="size-10">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-emerald-500 font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {fullName || displayName}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{emailAddress}</p>
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top" className="w-72">
          <DropdownMenuLabel className="text-sm">My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setOpenSettings(true)
            }}
          >
            <Settings className="size-4" />
            Profile Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="px-1.5 py-1">
            <div className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">Appearance</span>
              <div className="flex items-center gap-2">
                <Sun className="size-4 text-slate-500" />
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  aria-label="Toggle dark mode"
                />
                <Moon className="size-4 text-slate-500" />
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault()
              void handleSignOut()
            }}
            disabled={isSigningOut}
          >
            {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openSettings} onOpenChange={setOpenSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you are done.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="relative">
                <Avatar className="size-20">
                  <AvatarImage src={avatarUrl || undefined} alt={fullName || displayName} />
                  <AvatarFallback className="bg-emerald-500 text-3xl font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border border-slate-300 bg-slate-900 text-white shadow-sm"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload avatar"
                >
                  <Camera className="size-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>
              <p className="text-xs text-slate-500">Allowed: JPG, PNG (Max 2MB)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-address">Email Address</Label>
              <Input id="email-address" value={emailAddress} disabled className="opacity-70" />
              <p className="text-xs text-slate-500">Email address cannot be changed directly here.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>

            {statusMessage && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {statusMessage}
              </p>
            )}

            {errorMessage && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMessage}
              </p>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button onClick={() => void handleSaveSettings()} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
