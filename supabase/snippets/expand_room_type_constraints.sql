-- Expand allowed room types to support import/export values:
-- Lecture, Computer Lab, Accreditation Room, AVR, CISCO

alter table public.rooms drop constraint if exists rooms_type_check;

alter table public.rooms
add constraint rooms_type_check check (
  type = any (
    array[
      'Lecture'::text,
      'Computer Lab'::text,
      'Accreditation Room'::text,
      'AVR'::text,
      'CISCO'::text
    ]
  )
);

alter table public.subjects drop constraint if exists subjects_room_type_check;

alter table public.subjects
add constraint subjects_room_type_check check (
  room_type = any (
    array[
      'Lecture'::text,
      'Computer Lab'::text,
      'Accreditation Room'::text,
      'AVR'::text,
      'CISCO'::text
    ]
  )
);
