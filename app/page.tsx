import { Suspense } from "react"
import { AuthPage } from "@/components/auth/auth-page"

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  )
}
