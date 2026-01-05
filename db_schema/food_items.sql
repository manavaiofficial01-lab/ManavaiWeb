create table public.food_items (
  id serial not null,
  name text not null,
  price numeric(10, 2) not null,
  original_price numeric(10, 2) null,
  category text not null,
  restaurant_name text not null,
  rating numeric(2, 1) null default 4.5,
  review_count integer null default 0,
  veg boolean null default true,
  popular boolean null default false,
  bestseller boolean null default false,
  calories integer null,
  prep_time text null,
  image_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  profit numeric(10, 2) null,
  food_position integer null default 0,
  morning boolean null default false,
  afternoon boolean null default false,
  night boolean null default false,
  zone_name text null,
  stock boolean not null default true,
  evening boolean not null default false,
  constraint food_items_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_food_items_bestseller on public.food_items using btree (bestseller) TABLESPACE pg_default;

create index IF not exists idx_food_items_category on public.food_items using btree (category) TABLESPACE pg_default;

create index IF not exists idx_food_items_food_position on public.food_items using btree (food_position) TABLESPACE pg_default;

create index IF not exists idx_food_items_popular on public.food_items using btree (popular) TABLESPACE pg_default;

create index IF not exists idx_food_items_restaurant_name on public.food_items using btree (restaurant_name) TABLESPACE pg_default;
