create table public.driver (
  id bigserial not null,
  driver_name text not null,
  driver_phone text not null,
  password text not null,
  latitude double precision null,
  longitude double precision null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  logined_at timestamp with time zone null,
  logged_out timestamp with time zone null,
  status text null default 'offline'::text,
  fcm_token text null,
  device_id text null,
  app_version text null,
  last_active timestamp with time zone null default now(),
  daily_duty_hours numeric null default 10,
  zone text null,
  radius_in_km bigint null,
  constraint driver_pkey primary key (id),
  constraint driver_driver_phone_key unique (driver_phone)
) TABLESPACE pg_default;

create index IF not exists driver_phone_idx on public.driver using btree (driver_phone) TABLESPACE pg_default;

create index IF not exists driver_status_idx on public.driver using btree (status) TABLESPACE pg_default;

create trigger set_timestamp BEFORE
update on driver for EACH row
execute FUNCTION update_timestamp ();
