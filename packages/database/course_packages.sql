-- ====================================================================
-- Course Packages & Course Package Items Migration
-- ====================================================================

-- 1. Create course_packages table
CREATE TABLE IF NOT EXISTS public.course_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    package_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    validity_days INTEGER DEFAULT 365,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create course_package_items table
CREATE TABLE IF NOT EXISTS public.course_package_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.course_packages(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_course_package_items UNIQUE (package_id, course_id)
);

-- 3. Add indexes for performance & foreign keys
CREATE INDEX IF NOT EXISTS idx_course_package_items_package_id ON public.course_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_course_package_items_course_id ON public.course_package_items(course_id);
CREATE INDEX IF NOT EXISTS idx_course_packages_status ON public.course_packages(status);
CREATE INDEX IF NOT EXISTS idx_course_packages_package_code ON public.course_packages(package_code);

-- 4. Enable RLS
ALTER TABLE public.course_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_package_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'course_packages' AND policyname = 'Allow public read on course_packages'
    ) THEN
        CREATE POLICY "Allow public read on course_packages" ON public.course_packages FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'course_packages' AND policyname = 'Allow all for service role on course_packages'
    ) THEN
        CREATE POLICY "Allow all for service role on course_packages" ON public.course_packages TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'course_package_items' AND policyname = 'Allow public read on course_package_items'
    ) THEN
        CREATE POLICY "Allow public read on course_package_items" ON public.course_package_items FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'course_package_items' AND policyname = 'Allow all for service role on course_package_items'
    ) THEN
        CREATE POLICY "Allow all for service role on course_package_items" ON public.course_package_items TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
