# Auth System Upgrade - 2026-04-01

## Summary
Implemented a structured Supabase auth architecture with:
- Protected dashboard routing
- Server-only Supabase utilities
- Email confirmation route handling
- Forgot-password and reset-password flows
- Refactored auth UI into reusable components

## New Structure

### App routes
- app/page.tsx
- app/dashboard/page.tsx
- app/auth/forgot-password/page.tsx
- app/auth/reset-password/page.tsx
- app/auth/confirm/route.ts
- proxy.ts

### Auth components
- components/auth/auth-page.tsx
- components/auth/forgot-password-form.tsx
- components/auth/reset-password-form.tsx
- components/auth/sign-out-button.tsx

### Supabase utilities
- lib/supabase/browser-client.ts
- lib/supabase/server-client.ts
- lib/supabase/service-role-client.ts
- lib/supabase/proxy.ts
- lib/supabase/env.ts

## Behavior Changes

1. Root auth page now redirects signed-in users to /dashboard.
2. /dashboard is protected by proxy and server-side user validation.
3. Signup now sends confirmation links to /auth/confirm.
4. Confirm route verifies OTP token and redirects to dashboard.
5. Forgot password sends reset link to /auth/reset-password.
6. Reset password page updates user password via recovery session.
7. Dashboard includes Sign Out action that returns users to /.
8. Signup now captures age, phone number, and sex, and validates confirm password.
9. Signup metadata is synced into public.profiles for structured querying.

## Profile Database Migration (2026-04-02)

- Added: supabase/migrations/20260402_add_profiles_table.sql
- Creates: public.profiles table with columns:
	- id (uuid, references auth.users)
	- full_name (text)
	- age (integer)
	- phone (text)
	- sex (text)
	- created_at / updated_at (timestamptz)
- Adds trigger from auth.users insert to auto-create/update profile rows.
- Enables RLS and adds owner-only select/insert/update policies.

## Security Notes

- Service role key access is isolated in lib/supabase/service-role-client.ts and marked server-only.
- Public browser auth uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Redirect path after auth is sanitized to avoid open redirects.

## Required Environment Variables

- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY (for AI features; not required for auth)

## Dependency Added

- @supabase/ssr
