create table public.orders (
  id bigserial not null,
  user_id text null,
  customer_name text not null,
  customer_phone text null,
  items jsonb not null,
  total_amount numeric not null,
  delivery_address text not null,
  payment_method text not null,
  status text null default 'pending'::text,
  promo_code text null,
  razorpay_payment_id text null,
  payment_completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  customer_lat double precision null,
  customer_lon double precision null,
  receipt_reference text null,
  razorpay_order_id text null,
  razorpay_signature text null,
  delivery_time timestamp with time zone null,
  driver_name text null,
  driver_mobile text null,
  otp text null,
  delivery_distance_km numeric(10, 2) null,
  order_type text null,
  restaurant_name text null,
  category text null,
  delivery_charges numeric(10, 2) null,
  delivery_charges_breakdown text null,
  delivery_calculation_method text null,
  driver_status text null default 'order_placed'::text,
  cash_collected boolean null default false,
  payment_verified boolean null default false,
  accepted_manually boolean null default false,
  accepted_at timestamp with time zone null default now(),
  is_warehouse_pickup boolean null default false,
  is_ecommerce boolean null default false,
  cash_collected_amount numeric(10, 2) null default 0,
  driver_order_earnings numeric(10, 2) null,
  pickup_proof_timestamp timestamp with time zone null,
  pickup_proof_image text null,
  restaurant_status text null,
  restaurant_earnings numeric(10, 2) null default 0,
  warehouse text null,
  is_settled boolean null default false,
  driver_assigned_notified_at timestamp with time zone null,
  cash integer null default 0,
  upi integer null default 0,
  customer_verified boolean null,
  vendor_accepted boolean null,
  constraint orders_pkey primary key (id),
  constraint orders_driver_status_check check (
    (
      driver_status = any (
        array[
          'order_placed'::text,
          'partner_accepted'::text,
          'reached_pickup_location'::text,
          'pickup_completed'::text,
          'item_not_available'::text,
          'restaurant_closed'::text,
          'reached_customer_location'::text,
          'cash_collected'::text,
          'paid_by_qr'::text,
          'already_paid'::text,
          'order_completed'::text,
          'cancelled'::text
        ]
      )
    )
  ),
  constraint orders_restaurant_status_check check (
    (
      restaurant_status = any (array['accepted'::text, 'rejected'::text])
    )
  ),
  constraint orders_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'confirmed'::text,
          'paid'::text,
          'processing'::text,
          'shipped'::text,
          'delivered'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_orders_driver_earnings on public.orders using btree (driver_order_earnings) TABLESPACE pg_default
where
  (driver_order_earnings is not null);

create index IF not exists idx_orders_driver_mobile on public.orders using btree (driver_mobile) TABLESPACE pg_default;

create index IF not exists idx_orders_is_settled on public.orders using btree (is_settled) TABLESPACE pg_default;

create index IF not exists idx_orders_status on public.orders using btree (status) TABLESPACE pg_default;

create index IF not exists orders_created_at_idx on public.orders using btree (created_at) TABLESPACE pg_default;

create index IF not exists orders_driver_mobile_idx on public.orders using btree (driver_mobile) TABLESPACE pg_default;

create index IF not exists orders_driver_name_idx on public.orders using btree (driver_name) TABLESPACE pg_default;

create index IF not exists orders_driver_status_idx on public.orders using btree (driver_status) TABLESPACE pg_default;

create index IF not exists orders_items_gin_idx on public.orders using gin (items) TABLESPACE pg_default;

create index IF not exists orders_order_type_idx on public.orders using btree (order_type) TABLESPACE pg_default;

create index IF not exists orders_payment_method_idx on public.orders using btree (payment_method) TABLESPACE pg_default;

create index IF not exists orders_restaurant_earnings_idx on public.orders using btree (restaurant_earnings) TABLESPACE pg_default;

create index IF not exists orders_restaurant_status_idx on public.orders using btree (restaurant_status) TABLESPACE pg_default;

create index IF not exists orders_status_created_at_idx on public.orders using btree (status, created_at) TABLESPACE pg_default;

create index IF not exists orders_status_idx on public.orders using btree (status) TABLESPACE pg_default;

create index IF not exists orders_user_id_idx on public.orders using btree (user_id) TABLESPACE pg_default;

create index IF not exists orders_user_status_idx on public.orders using btree (user_id, status) TABLESPACE pg_default;

create trigger order_status_update_consolidated
after
update OF status on orders for EACH row
execute FUNCTION handle_order_status_update_consolidated ();

create trigger order_status_update_trigger
after
update OF status on orders for EACH row
execute FUNCTION handle_order_status_update ();

create trigger orders_set_driver_earnings BEFORE INSERT
or
update OF status on orders for EACH row when (new.status = 'processing'::text)
execute FUNCTION compute_driver_earnings_on_processing ();

create trigger on_order_assigned
after
update OF driver_mobile on orders for EACH row
execute FUNCTION trigger_order_assignment ();

create trigger on_order_update
after
update on orders for EACH row
execute FUNCTION handle_order_update ();

create trigger on_order_notification_insert
after INSERT on orders for EACH row
execute FUNCTION handle_order_notification ();

create trigger on_order_notification_update
after
update on orders for EACH row
execute FUNCTION handle_order_notification (); --- set the collection button near the today to see the day by day drivers cash , upi , online payment in the order tracking
