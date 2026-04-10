-- Expands accepted program values for subjects and legacy courses tables.
-- Apply in Supabase SQL editor.

alter table if exists public.subjects
  drop constraint if exists subjects_program_check;

alter table if exists public.subjects
  add constraint subjects_program_check
  check (
    program = any (
      array[
        'CS'::text,
        'IT'::text,
        'IS'::text,
        'FREE'::text,
        'BSCS'::text,
        'BSIS'::text,
        'FREE1'::text,
        'FREE2'::text,
        'FREE3'::text,
        'FREE4'::text,
        'FREE5'::text,
        'FREE6'::text,
        'FREE7'::text,
        'FREE8'::text,
        'NA'::text,
        'TSM'::text,
        'WMA'::text
      ]
    )
  );

alter table if exists public.courses
  drop constraint if exists courses_program_check;

alter table if exists public.courses
  add constraint courses_program_check
  check (
    program = any (
      array[
        'CS'::text,
        'IT'::text,
        'IS'::text,
        'FREE'::text,
        'BSCS'::text,
        'BSIS'::text,
        'FREE1'::text,
        'FREE2'::text,
        'FREE3'::text,
        'FREE4'::text,
        'FREE5'::text,
        'FREE6'::text,
        'FREE7'::text,
        'FREE8'::text,
        'NA'::text,
        'TSM'::text,
        'WMA'::text
      ]
    )
  );
