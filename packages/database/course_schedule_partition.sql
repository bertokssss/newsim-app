-- ============================================================================
-- Course Schedule Partition
-- Splits each course's total training days (ceil(duration_hours / 8)) into:
--   theory_days    : days allotted to reading modules + module assessments + post-test
--   practical_days : days allotted to instructor-led practical training sessions
-- Rule enforced by the admin API: theory_days + practical_days = total course days.
-- ============================================================================

alter table public.courses
  add column if not exists theory_days integer,
  add column if not exists practical_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_theory_days_check') then
    alter table public.courses
      add constraint courses_theory_days_check check (theory_days is null or theory_days >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_practical_days_check') then
    alter table public.courses
      add constraint courses_practical_days_check check (practical_days is null or practical_days >= 0);
  end if;
end $$;

comment on column public.courses.theory_days is 'Days allotted for modules/assessments (theory phase). theory_days + practical_days = ceil(duration_hours/8).';
comment on column public.courses.practical_days is 'Days allotted for instructor practical training sessions (practical phase).';

-- Seed a default partition for every course that does not have one yet:
--   ~40% of the days for theory (at least 1, always leaving at least 1 practical day
--   when the course is 2+ days), the rest for practical.
--   Example: AFF 40h = 5 days -> 2 theory days + 3 practical days.
with d as (
  select
    c.id,
    greatest(1, ceil(coalesce(c.duration_hours, 40) / 8.0))::int as total_days
  from public.courses c
  where c.theory_days is null or c.practical_days is null
),
p as (
  select
    d.id,
    d.total_days,
    case
      when d.total_days <= 1 then 1
      else least(d.total_days - 1, greatest(1, round(d.total_days * 0.4)::int))
    end as theory
  from d
)
update public.courses c
set theory_days = p.theory,
    practical_days = p.total_days - p.theory
from p
where c.id = p.id;
