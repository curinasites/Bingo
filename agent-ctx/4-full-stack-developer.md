# Task 4 - Fix Admin Panel Real User Names

## Agent: full-stack-developer

## Summary
Fixed the admin panel to show real user names and emails instead of placeholder names like "Usuário {uuid}".

## Problem
The admin API route (`/api/admin`) returned placeholder names because:
- The Supabase client uses an anon key, which cannot access `auth.users` data
- There was no mechanism to look up user names from their Supabase UUIDs

## Solution: Dual-Strategy Approach

### Strategy 1 (Primary): Supabase RPC Function
- Added `get_users_with_carteiras()` SECURITY DEFINER SQL function to `supabase-setup.sql`
- This function runs with elevated privileges on the database side, allowing it to join `carteiras` with `auth.users`
- Returns real user names (from `raw_user_meta_data->>'name'`), emails, and wallet balances
- Includes GRANT EXECUTE for anon and authenticated roles
- Works immediately once the SQL is executed in the Supabase dashboard

### Strategy 2 (Fallback): Local Prisma Profile Cache
- Added `UserProfile` model to Prisma schema (supabaseId, email, name)
- User profiles are automatically cached/upserted on:
  - Registration (`/api/auth/register`)
  - Login (`/api/auth/login`)
  - Session refresh (`/api/auth/me`)
- Admin route falls back to querying local Prisma database for user names when RPC is unavailable
- This approach works immediately without needing any SQL to be run on Supabase

## Files Modified
1. `supabase-setup.sql` — Added RPC function definition
2. `prisma/schema.prisma` — Replaced unused User/Post with UserProfile model
3. `src/app/api/admin/route.ts` — Added dual-strategy user name lookup
4. `src/app/api/auth/register/route.ts` — Added profile caching
5. `src/app/api/auth/login/route.ts` — Added profile caching
6. `src/app/api/auth/me/route.ts` — Added profile caching

## Verification
- ESLint passes with no errors
- Dev server runs without issues
- No breaking changes to API contract or frontend
