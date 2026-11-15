-- Create instructors table linked to profiles
CREATE TABLE IF NOT EXISTS public.instructors (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    employment_type VARCHAR(50) CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contract')),
    date_hired DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- In case the table was already created before the username field was added
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Enable RLS
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Create policies for instructors table
DROP POLICY IF EXISTS "Service role has full access to instructors" ON public.instructors;
CREATE POLICY "Service role has full access to instructors" ON public.instructors
    USING (true) WITH CHECK (true);

-- Allow authenticated users to view instructors (if they are admins or super admins)
DROP POLICY IF EXISTS "Admins can view instructors" ON public.instructors;
CREATE POLICY "Admins can view instructors" ON public.instructors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin', 'ADMIN')
        )
    );

-- Allow instructors to view their own instructor record
DROP POLICY IF EXISTS "Instructors can view own record" ON public.instructors;
CREATE POLICY "Instructors can view own record" ON public.instructors
    FOR SELECT USING (profile_id = auth.uid());

-- Allow instructors to update their own record
DROP POLICY IF EXISTS "Instructors can update own record" ON public.instructors;
CREATE POLICY "Instructors can update own record" ON public.instructors
    FOR UPDATE USING (profile_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_instructors_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_instructors_updated_at ON public.instructors;
CREATE TRIGGER update_instructors_updated_at
    BEFORE UPDATE ON public.instructors
    FOR EACH ROW
    EXECUTE FUNCTION update_instructors_updated_at_column();
