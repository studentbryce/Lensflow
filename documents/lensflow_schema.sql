-- ============================================================================
-- LensFlow V1 - Canonical Supabase Database Recovery / Migration Schema
-- Generated from the live LensFlow database metadata snapshot (2026-09-08).
--
-- TARGET:
--   Run against a NEW Supabase project after Supabase has provisioned its
--   managed schemas (auth, storage, extensions, etc.).
--
-- IMPORTANT:
--   * This recreates LensFlow DATABASE STRUCTURE, RLS and Storage configuration.
--   * It does NOT recreate auth.users accounts, application row data, or files
--     stored inside Supabase Storage.
--   * Restore authentication users/data/storage objects separately if migrating
--     a live system.
--   * The script intentionally does not recreate Supabase-managed schemas.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 01. Extensions used by the source project
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 02. LensFlow private schema
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- 03. Application enum types
-- ---------------------------------------------------------------------------
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'declined');
CREATE TYPE public.calendar_provider AS ENUM ('google');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.media_type AS ENUM ('image', 'video');
CREATE TYPE public.payment_status AS ENUM ('pending', 'successful', 'failed', 'refunded');
CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.user_role AS ENUM ('photographer', 'client');

-- ---------------------------------------------------------------------------
-- 04. Application tables (exact columns/defaults/nullability)
-- ---------------------------------------------------------------------------

CREATE TABLE public.availability_exceptions (
    exception_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    exception_date date NOT NULL,
    start_time time,
    end_time time,
    is_available boolean DEFAULT false NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.availability_rules (
    availability_rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.bookings (
    booking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    client_id uuid NOT NULL,
    service_id uuid NOT NULL,
    booking_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    location text,
    notes text,
    status public.booking_status DEFAULT 'pending'::public.booking_status NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.calendar_integrations (
    integration_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    provider public.calendar_provider DEFAULT 'google'::public.calendar_provider NOT NULL,
    calendar_id varchar(255),
    access_token text,
    refresh_token text,
    token_expires_at timestamptz,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.clients (
    client_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.conversations (
    conversation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.galleries (
    gallery_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    name varchar(150) NOT NULL,
    description text,
    is_published boolean DEFAULT false NOT NULL,
    allow_downloads boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.invoice_items (
    invoice_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    service_id uuid NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL
);

CREATE TABLE public.invoices (
    invoice_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    invoice_number varchar(50) NOT NULL,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    tax_rate numeric(5,2) DEFAULT 15.00 NOT NULL,
    tax_included boolean DEFAULT false NOT NULL
);

CREATE TABLE public.media (
    media_id uuid DEFAULT gen_random_uuid() NOT NULL,
    gallery_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    file_name varchar(255) NOT NULL,
    storage_path text NOT NULL,
    media_type public.media_type NOT NULL,
    mime_type varchar(100),
    file_size bigint,
    thumbnail_path text,
    is_downloadable boolean DEFAULT true NOT NULL,
    uploaded_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.media_favourites (
    favourite_id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type varchar(50) NOT NULL,
    title varchar(150) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    client_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency char(3) DEFAULT 'NZD'::bpchar NOT NULL,
    payment_method varchar(50),
    stripe_payment_id varchar(255),
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    paid_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.photographer_profiles (
    photographer_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_name varchar(150) NOT NULL,
    slug varchar(100) NOT NULL,
    description text,
    email varchar(255) NOT NULL,
    phone varchar(30),
    website_url text,
    logo_url text,
    profile_image_url text,
    address text,
    published boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.portfolio_items (
    portfolio_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    title varchar(150) NOT NULL,
    description text,
    media_url text NOT NULL,
    thumbnail_url text,
    category varchar(100),
    display_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    source_media_id uuid
);

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    role public.user_role NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    email varchar(255) NOT NULL,
    phone varchar(30),
    avatar_url text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    status public.review_status DEFAULT 'pending'::public.review_status NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.services (
    service_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    name varchar(150) NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    duration_minutes integer NOT NULL,
    deposit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.website_content (
    content_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    section varchar(50) NOT NULL,
    title varchar(150),
    content text,
    image_url text,
    display_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.website_settings (
    website_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    theme varchar(50),
    primary_colour varchar(20),
    secondary_colour varchar(20),
    font_family varchar(100),
    hero_title varchar(150),
    hero_description text,
    hero_image_url text,
    show_about boolean DEFAULT true NOT NULL,
    show_services boolean DEFAULT true NOT NULL,
    show_portfolio boolean DEFAULT true NOT NULL,
    show_reviews boolean DEFAULT true NOT NULL,
    show_contact boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- 05. Primary keys, UNIQUE constraints and CHECK constraints
-- ---------------------------------------------------------------------------
ALTER TABLE public.availability_exceptions ADD CONSTRAINT availability_exceptions_pkey PRIMARY KEY (exception_id);
ALTER TABLE public.availability_exceptions ADD CONSTRAINT availability_exceptions_time_valid CHECK (start_time IS NULL OR end_time IS NULL OR start_time < end_time);
ALTER TABLE public.availability_rules ADD CONSTRAINT availability_rules_pkey PRIMARY KEY (availability_rule_id);
ALTER TABLE public.availability_rules ADD CONSTRAINT availability_rules_day_valid CHECK (day_of_week >= 0 AND day_of_week <= 6);
ALTER TABLE public.availability_rules ADD CONSTRAINT availability_rules_time_valid CHECK (start_time < end_time);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (booking_id);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_time_valid CHECK (start_time < end_time);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_total_non_negative CHECK (total_amount >= 0::numeric);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_photographer_booking_unique UNIQUE (photographer_id, booking_id);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_photographer_client_booking_unique UNIQUE (photographer_id, client_id, booking_id);
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_pkey PRIMARY KEY (integration_id);
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_provider_unique UNIQUE (photographer_id, provider);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);
ALTER TABLE public.clients ADD CONSTRAINT clients_photographer_client_unique UNIQUE (photographer_id, client_id);
ALTER TABLE public.clients ADD CONSTRAINT clients_user_unique UNIQUE (user_id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_photographer_client_unique UNIQUE (photographer_id, client_id);
ALTER TABLE public.galleries ADD CONSTRAINT galleries_pkey PRIMARY KEY (gallery_id);
ALTER TABLE public.galleries ADD CONSTRAINT galleries_booking_unique UNIQUE (booking_id);
ALTER TABLE public.galleries ADD CONSTRAINT galleries_photographer_gallery_unique UNIQUE (photographer_id, gallery_id);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (invoice_item_id);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_subtotal_non_negative CHECK (subtotal >= 0::numeric);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_unit_price_non_negative CHECK (unit_price >= 0::numeric);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (invoice_id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_due_date_valid CHECK (due_date IS NULL OR due_date >= issue_date);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_subtotal_non_negative CHECK (subtotal >= 0::numeric);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tax_non_negative CHECK (tax_amount >= 0::numeric);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_total_non_negative CHECK (total_amount >= 0::numeric);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_booking_unique UNIQUE (booking_id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_number_unique UNIQUE (invoice_number);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_photographer_client_invoice_unique UNIQUE (photographer_id, client_id, invoice_id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_photographer_invoice_unique UNIQUE (photographer_id, invoice_id);
ALTER TABLE public.media ADD CONSTRAINT media_pkey PRIMARY KEY (media_id);
ALTER TABLE public.media ADD CONSTRAINT media_file_size_non_negative CHECK (file_size IS NULL OR file_size >= 0);
ALTER TABLE public.media_favourites ADD CONSTRAINT media_favourites_pkey PRIMARY KEY (favourite_id);
ALTER TABLE public.media_favourites ADD CONSTRAINT media_favourites_unique UNIQUE (media_id, client_id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0::numeric);
ALTER TABLE public.payments ADD CONSTRAINT payments_stripe_id_unique UNIQUE (stripe_payment_id);
ALTER TABLE public.photographer_profiles ADD CONSTRAINT photographer_profiles_pkey PRIMARY KEY (photographer_id);
ALTER TABLE public.photographer_profiles ADD CONSTRAINT photographer_profiles_slug_unique UNIQUE (slug);
ALTER TABLE public.photographer_profiles ADD CONSTRAINT photographer_profiles_user_unique UNIQUE (user_id);
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_pkey PRIMARY KEY (portfolio_id);
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_photographer_display_order_unique UNIQUE (photographer_id, display_order);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_valid CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_booking_unique UNIQUE (booking_id);
ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (service_id);
ALTER TABLE public.services ADD CONSTRAINT services_deposit_non_negative CHECK (deposit_amount >= 0::numeric);
ALTER TABLE public.services ADD CONSTRAINT services_duration_positive CHECK (duration_minutes > 0);
ALTER TABLE public.services ADD CONSTRAINT services_price_non_negative CHECK (price >= 0::numeric);
ALTER TABLE public.services ADD CONSTRAINT services_photographer_service_unique UNIQUE (photographer_id, service_id);
ALTER TABLE public.website_content ADD CONSTRAINT website_content_pkey PRIMARY KEY (content_id);
ALTER TABLE public.website_settings ADD CONSTRAINT website_settings_pkey PRIMARY KEY (website_id);
ALTER TABLE public.website_settings ADD CONSTRAINT website_settings_photographer_unique UNIQUE (photographer_id);

-- ---------------------------------------------------------------------------
-- 06. Foreign keys (including composite ownership constraints)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.photographer_profiles ADD CONSTRAINT photographer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.availability_exceptions ADD CONSTRAINT availability_exceptions_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.availability_rules ADD CONSTRAINT availability_rules_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.services ADD CONSTRAINT services_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE RESTRICT;
ALTER TABLE public.clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE RESTRICT;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_client_same_photographer_fk FOREIGN KEY (photographer_id, client_id) REFERENCES public.clients(photographer_id, client_id) ON DELETE RESTRICT;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_service_same_photographer_fk FOREIGN KEY (photographer_id, service_id) REFERENCES public.services(photographer_id, service_id) ON DELETE RESTRICT;
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_client_ownership_fk FOREIGN KEY (photographer_id, client_id) REFERENCES public.clients(photographer_id, client_id) ON DELETE CASCADE;
ALTER TABLE public.galleries ADD CONSTRAINT galleries_booking_ownership_fk FOREIGN KEY (photographer_id, client_id, booking_id) REFERENCES public.bookings(photographer_id, client_id, booking_id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_booking_ownership_fk FOREIGN KEY (photographer_id, client_id, booking_id) REFERENCES public.bookings(photographer_id, client_id, booking_id) ON DELETE RESTRICT;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_invoice_ownership_fk FOREIGN KEY (photographer_id, invoice_id) REFERENCES public.invoices(photographer_id, invoice_id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_service_ownership_fk FOREIGN KEY (photographer_id, service_id) REFERENCES public.services(photographer_id, service_id) ON DELETE RESTRICT;
ALTER TABLE public.media ADD CONSTRAINT media_gallery_ownership_fk FOREIGN KEY (photographer_id, gallery_id) REFERENCES public.galleries(photographer_id, gallery_id) ON DELETE CASCADE;
ALTER TABLE public.media_favourites ADD CONSTRAINT media_favourites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;
ALTER TABLE public.media_favourites ADD CONSTRAINT media_favourites_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(media_id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(invoice_id) ON DELETE RESTRICT;
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_source_media_fk FOREIGN KEY (source_media_id) REFERENCES public.media(media_id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_booking_ownership_fk FOREIGN KEY (photographer_id, client_id, booking_id) REFERENCES public.bookings(photographer_id, client_id, booking_id) ON DELETE RESTRICT;
ALTER TABLE public.website_content ADD CONSTRAINT website_content_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;
ALTER TABLE public.website_settings ADD CONSTRAINT website_settings_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(photographer_id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 07. Non-constraint indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_availability_exceptions_photographer_date ON public.availability_exceptions USING btree (photographer_id, exception_date);
CREATE INDEX idx_availability_rules_day ON public.availability_rules USING btree (photographer_id, day_of_week);
CREATE INDEX idx_availability_rules_photographer ON public.availability_rules USING btree (photographer_id);
CREATE INDEX idx_bookings_client ON public.bookings USING btree (client_id);
CREATE INDEX idx_bookings_date ON public.bookings USING btree (photographer_id, booking_date);
CREATE INDEX idx_bookings_photographer ON public.bookings USING btree (photographer_id);
CREATE INDEX idx_bookings_service ON public.bookings USING btree (service_id);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (photographer_id, status);
CREATE INDEX idx_calendar_integrations_photographer ON public.calendar_integrations USING btree (photographer_id);
CREATE INDEX idx_clients_photographer ON public.clients USING btree (photographer_id);
CREATE INDEX idx_clients_user ON public.clients USING btree (user_id);
CREATE INDEX idx_conversations_client ON public.conversations USING btree (client_id);
CREATE INDEX idx_conversations_photographer ON public.conversations USING btree (photographer_id);
CREATE INDEX idx_galleries_booking ON public.galleries USING btree (booking_id);
CREATE INDEX idx_galleries_client ON public.galleries USING btree (client_id);
CREATE INDEX idx_galleries_photographer ON public.galleries USING btree (photographer_id);
CREATE INDEX idx_galleries_published ON public.galleries USING btree (client_id, is_published);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id);
CREATE INDEX idx_invoice_items_photographer ON public.invoice_items USING btree (photographer_id);
CREATE INDEX idx_invoice_items_service ON public.invoice_items USING btree (service_id);
CREATE INDEX idx_invoices_booking ON public.invoices USING btree (booking_id);
CREATE INDEX idx_invoices_client ON public.invoices USING btree (client_id);
CREATE INDEX idx_invoices_photographer ON public.invoices USING btree (photographer_id);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (photographer_id, status);
CREATE INDEX idx_media_gallery ON public.media USING btree (gallery_id);
CREATE INDEX idx_media_photographer ON public.media USING btree (photographer_id);
CREATE INDEX idx_media_favourites_client ON public.media_favourites USING btree (client_id);
CREATE INDEX idx_media_favourites_media ON public.media_favourites USING btree (media_id);
CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);
CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_payments_client ON public.payments USING btree (client_id);
CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);
CREATE INDEX idx_payments_status ON public.payments USING btree (invoice_id, status);
CREATE INDEX idx_photographer_profiles_slug ON public.photographer_profiles USING btree (slug);
CREATE INDEX idx_portfolio_items_source_media_id ON public.portfolio_items USING btree (source_media_id);
CREATE INDEX idx_portfolio_photographer ON public.portfolio_items USING btree (photographer_id);
CREATE INDEX idx_portfolio_published ON public.portfolio_items USING btree (photographer_id, published);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_reviews_client ON public.reviews USING btree (client_id);
CREATE INDEX idx_reviews_photographer ON public.reviews USING btree (photographer_id);
CREATE INDEX idx_services_active ON public.services USING btree (photographer_id, is_active);
CREATE INDEX idx_services_photographer ON public.services USING btree (photographer_id);
CREATE INDEX idx_website_content_order ON public.website_content USING btree (photographer_id, display_order);
CREATE INDEX idx_website_content_photographer ON public.website_content USING btree (photographer_id);


-- ---------------------------------------------------------------------------
-- 08. Functions used by RLS and updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT client_id
    FROM public.clients
    WHERE user_id = (SELECT auth.uid())
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION private.current_photographer_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT photographer_id
    FROM public.photographer_profiles
    WHERE user_id = (SELECT auth.uid())
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION private.is_client()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = (SELECT auth.uid())
          AND role = 'client'
    );
$function$;

CREATE OR REPLACE FUNCTION private.is_photographer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = (SELECT auth.uid())
          AND role = 'photographer'
    );
$function$;

CREATE OR REPLACE FUNCTION private.owns_client(requested_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE client_id = requested_client_id
          AND user_id = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION private.owns_photographer(requested_photographer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.photographer_profiles
        WHERE photographer_id = requested_photographer_id
          AND user_id = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 09. updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER availability_exceptions_updated_at BEFORE UPDATE ON public.availability_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER availability_rules_updated_at BEFORE UPDATE ON public.availability_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER calendar_integrations_updated_at BEFORE UPDATE ON public.calendar_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER galleries_updated_at BEFORE UPDATE ON public.galleries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER photographer_profiles_updated_at BEFORE UPDATE ON public.photographer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_content_updated_at BEFORE UPDATE ON public.website_content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_settings_updated_at BEFORE UPDATE ON public.website_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 10. Grants
-- Source database grants ALL normal table privileges to anon/authenticated/
-- service_role; RLS remains the row-level security boundary.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.availability_exceptions, public.availability_rules, public.bookings, public.calendar_integrations, public.clients, public.conversations, public.galleries, public.invoice_items, public.invoices, public.media, public.media_favourites, public.messages, public.notifications, public.payments, public.photographer_profiles, public.portfolio_items, public.profiles, public.reviews, public.services, public.website_content, public.website_settings
TO anon, authenticated, service_role;

-- Match the source private-schema posture: no direct USAGE for API roles.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;

REVOKE ALL ON FUNCTION private.current_client_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_photographer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_client() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_photographer() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.owns_client(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.owns_photographer(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_photographer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_client() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_photographer() TO authenticated;
GRANT EXECUTE ON FUNCTION private.owns_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.owns_photographer(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Enable Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photographer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 12. Application RLS policies
-- ---------------------------------------------------------------------------

CREATE POLICY "Photographers manage availability exceptions"
ON public.availability_exceptions FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers manage availability rules"
ON public.availability_rules FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can create their own bookings"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can update their own bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (client_id = (SELECT private.current_client_id()))
WITH CHECK (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can view their bookings"
ON public.bookings FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers can create bookings"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can delete bookings"
ON public.bookings FOR DELETE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can update bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can view their bookings"
ON public.bookings FOR SELECT TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can create their calendar integration"
ON public.calendar_integrations FOR INSERT TO authenticated
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can delete their calendar integration"
ON public.calendar_integrations FOR DELETE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can update their calendar integration"
ON public.calendar_integrations FOR UPDATE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can view their calendar integration"
ON public.calendar_integrations FOR SELECT TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can create their own client record"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Clients can update their own record"
ON public.clients FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Clients can view their own client record"
ON public.clients FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Photographers can delete their clients"
ON public.clients FOR DELETE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can update their clients"
ON public.clients FOR UPDATE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can view their clients"
ON public.clients FOR SELECT TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can view their conversations"
ON public.conversations FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can update conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can view their conversations"
ON public.conversations FOR SELECT TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can view paid published galleries"
ON public.galleries FOR SELECT TO authenticated
USING (
    client_id = (SELECT private.current_client_id())
    AND is_published = true
    AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.booking_id = galleries.booking_id
          AND i.client_id = galleries.client_id
          AND i.status = 'paid'::public.invoice_status
    )
    AND EXISTS (
        SELECT 1
        FROM public.payments p
        JOIN public.invoices i ON i.invoice_id = p.invoice_id
        WHERE i.booking_id = galleries.booking_id
          AND p.status = 'successful'::public.payment_status
    )
);

CREATE POLICY "Photographers manage their galleries"
ON public.galleries FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can view their invoice items"
ON public.invoice_items FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.invoice_id = invoice_items.invoice_id
          AND i.client_id = (SELECT private.current_client_id())
    )
);

CREATE POLICY "Photographers manage their invoice items"
ON public.invoice_items FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can view their invoices"
ON public.invoices FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers manage their invoices"
ON public.invoices FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can view media in paid published galleries"
ON public.media FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.galleries g
        WHERE g.gallery_id = media.gallery_id
          AND g.client_id = (SELECT private.current_client_id())
          AND g.is_published = true
          AND EXISTS (
              SELECT 1 FROM public.invoices i
              WHERE i.booking_id = g.booking_id
                AND i.client_id = g.client_id
                AND i.status = 'paid'::public.invoice_status
          )
          AND EXISTS (
              SELECT 1
              FROM public.payments p
              JOIN public.invoices i ON i.invoice_id = p.invoice_id
              WHERE i.booking_id = g.booking_id
                AND p.status = 'successful'::public.payment_status
          )
    )
);

CREATE POLICY "Photographers manage their media"
ON public.media FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Clients can add favourites"
ON public.media_favourites FOR INSERT TO authenticated
WITH CHECK (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can remove favourites"
ON public.media_favourites FOR DELETE TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can view their favourites"
ON public.media_favourites FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers can view client favourites"
ON public.media_favourites FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.client_id = media_favourites.client_id
          AND c.photographer_id = (SELECT private.current_photographer_id())
    )
);

CREATE POLICY "Conversation participants can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.conversation_id = messages.conversation_id
          AND (
              c.photographer_id = (SELECT private.current_photographer_id())
              OR c.client_id = (SELECT private.current_client_id())
          )
    )
);

CREATE POLICY "Conversation participants can view messages"
ON public.messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.conversation_id = messages.conversation_id
          AND (
              c.photographer_id = (SELECT private.current_photographer_id())
              OR c.client_id = (SELECT private.current_client_id())
          )
    )
);

CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE TO authenticated
USING (sender_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = (SELECT auth.uid()))
WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Clients can create their own payment records"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
    client_id = (SELECT private.current_client_id())
    AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.invoice_id = payments.invoice_id
          AND i.client_id = (SELECT private.current_client_id())
    )
);

CREATE POLICY "Clients can view their payments"
ON public.payments FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers can view their payments"
ON public.payments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.invoice_id = payments.invoice_id
          AND i.photographer_id = (SELECT private.current_photographer_id())
    )
);

CREATE POLICY "Photographers can create their own profile"
ON public.photographer_profiles FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT private.is_photographer())
);

CREATE POLICY "Photographers can delete their own profile"
ON public.photographer_profiles FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Photographers can update their own profile"
ON public.photographer_profiles FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Photographers can view their own profile"
ON public.photographer_profiles FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Published photographer profiles are public"
ON public.photographer_profiles FOR SELECT TO anon, authenticated
USING (published = true);

CREATE POLICY "Photographers manage their portfolio"
ON public.portfolio_items FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Published portfolio items are public"
ON public.portfolio_items FOR SELECT TO anon, authenticated
USING (
    published = true
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles p
        WHERE p.photographer_id = portfolio_items.photographer_id
          AND p.published = true
    )
);

CREATE POLICY "Photographers can update their client profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.photographer_profiles pp ON pp.photographer_id = c.photographer_id
        WHERE c.user_id = profiles.user_id
          AND pp.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.photographer_profiles pp ON pp.photographer_id = c.photographer_id
        WHERE c.user_id = profiles.user_id
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can view their client profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.photographer_profiles pp ON pp.photographer_id = c.photographer_id
        WHERE c.user_id = profiles.user_id
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Approved reviews are public"
ON public.reviews FOR SELECT TO anon, authenticated
USING (status = 'approved'::public.review_status);

CREATE POLICY "Clients can create reviews"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
    client_id = (SELECT private.current_client_id())
    AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.booking_id = reviews.booking_id
          AND b.client_id = (SELECT private.current_client_id())
          AND b.status = 'completed'::public.booking_status
    )
);

CREATE POLICY "Clients can update their own reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (
    client_id = (SELECT private.current_client_id())
    AND status = 'pending'::public.review_status
)
WITH CHECK (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Clients can view their own reviews"
ON public.reviews FOR SELECT TO authenticated
USING (client_id = (SELECT private.current_client_id()));

CREATE POLICY "Photographers can delete their reviews"
ON public.reviews FOR DELETE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can moderate their reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers can view their reviews"
ON public.reviews FOR SELECT TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Active services are publicly visible"
ON public.services FOR SELECT TO anon, authenticated
USING (
    is_active = true
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles p
        WHERE p.photographer_id = services.photographer_id
          AND p.published = true
    )
);

CREATE POLICY "Photographers manage their services"
ON public.services FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Photographers manage their website content"
ON public.website_content FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Published website content is public"
ON public.website_content FOR SELECT TO anon, authenticated
USING (
    published = true
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles p
        WHERE p.photographer_id = website_content.photographer_id
          AND p.published = true
    )
);

CREATE POLICY "Photographers manage their website settings"
ON public.website_settings FOR ALL TO authenticated
USING (photographer_id = (SELECT private.current_photographer_id()))
WITH CHECK (photographer_id = (SELECT private.current_photographer_id()));

CREATE POLICY "Published website settings are public"
ON public.website_settings FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.photographer_profiles p
        WHERE p.photographer_id = website_settings.photographer_id
          AND p.published = true
    )
);


-- ---------------------------------------------------------------------------
-- 13. Supabase Storage buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
)
VALUES
(
    'client-media',
    'client-media',
    false,
    524288000,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
    ]::text[]
),
(
    'portfolio-media',
    'portfolio-media',
    true,
    26214400,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 14. Supabase Storage RLS policies
-- ---------------------------------------------------------------------------

CREATE POLICY "Clients can view purchased gallery media"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'client-media'
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.clients c
          ON c.client_id = g.client_id
        JOIN public.invoices i
          ON i.booking_id = g.booking_id
         AND i.client_id = g.client_id
         AND i.photographer_id = g.photographer_id
        JOIN public.payments p
          ON p.invoice_id = i.invoice_id
         AND p.client_id = c.client_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND c.user_id = auth.uid()
          AND g.is_published = true
          AND p.paid_at IS NOT NULL
    )
);

CREATE POLICY "Photographers can delete portfolio media"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'portfolio-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles pp
        WHERE pp.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can delete their client media"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'client-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.photographer_profiles pp ON pp.photographer_id = g.photographer_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can update portfolio media"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'portfolio-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles pp
        WHERE pp.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'portfolio-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles pp
        WHERE pp.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can update their client media"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'client-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.photographer_profiles pp ON pp.photographer_id = g.photographer_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'client-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.photographer_profiles pp ON pp.photographer_id = g.photographer_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can upload client media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'client-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.photographer_profiles pp ON pp.photographer_id = g.photographer_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can upload portfolio media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'portfolio-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1 FROM public.photographer_profiles pp
        WHERE pp.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

CREATE POLICY "Photographers can view their client media"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'client-media'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
        SELECT 1
        FROM public.galleries g
        JOIN public.photographer_profiles pp ON pp.photographer_id = g.photographer_id
        WHERE g.gallery_id = ((storage.foldername(storage.objects.name))[2])::uuid
          AND g.photographer_id = ((storage.foldername(storage.objects.name))[1])::uuid
          AND pp.user_id = auth.uid()
    )
);

-- Source snapshot had no custom policies on storage.buckets.
-- portfolio-media is public, so it requires no custom SELECT policy.

-- ---------------------------------------------------------------------------
-- 15. Realtime / replica identity
-- ---------------------------------------------------------------------------
-- Source snapshot:
--   * No LensFlow public tables were explicitly added to a publication.
--   * All LensFlow tables used REPLICA IDENTITY DEFAULT.
-- Therefore no publication or replica-identity changes are required here.

COMMIT;

-- ============================================================================
-- End LensFlow V1 schema
-- ============================================================================
