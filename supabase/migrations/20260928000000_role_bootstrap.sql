-- Migration: 20260928000000_role_bootstrap.sql
-- Description: Bounded admin + teacher privilege foundation (Handoff 007)
-- Sets up role storage, explicit table grants, and RLS policies.

-- 1. Create role enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
    END IF;
END$$;

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, role)
);

-- Index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);

-- 3. Enable and enforce Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- 4. Explicit table grants (least privilege)
-- Revoke all default public/anon/authenticated permissions
REVOKE ALL ON TABLE public.user_roles FROM public;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM authenticated;

-- Allow authenticated users SELECT only (subject to RLS policy)
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- Service role retains full access for administrative operations & migrations
GRANT ALL ON TABLE public.user_roles TO service_role;

-- 5. RLS Policies
-- Authenticated users may ONLY view their own role records
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: NO insert, update, or delete policies are granted to authenticated or anon.
-- Any direct mutation attempt through the Supabase client API will fail at the DB boundary.
