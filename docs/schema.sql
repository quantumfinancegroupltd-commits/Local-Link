--
-- PostgreSQL database dump
--

\restrict AUHoe5hWBeb4UlyHy34j03pdqV0Ey7bc6cf2iHEkoHFr4OwunwLrP4URV7Torst

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_status AS ENUM (
    'created',
    'driver_assigned',
    'picked_up',
    'on_the_way',
    'delivered',
    'confirmed',
    'cancelled'
);


--
-- Name: dispute_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispute_status AS ENUM (
    'open',
    'under_review',
    'resolved',
    'rejected'
);


--
-- Name: driver_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_status AS ENUM (
    'pending',
    'approved',
    'restricted',
    'suspended'
);


--
-- Name: escrow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.escrow_status AS ENUM (
    'pending_payment',
    'held',
    'released',
    'refunded',
    'disputed',
    'cancelled',
    'failed',
    'created',
    'in_progress',
    'completed_pending_confirmation'
);


--
-- Name: escrow_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.escrow_type AS ENUM (
    'job',
    'order'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'dispatched',
    'delivered',
    'cancelled'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed'
);


--
-- Name: payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payout_status AS ENUM (
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'available',
    'sold',
    'pending',
    'cancelled'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'paused',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'buyer',
    'artisan',
    'farmer',
    'admin',
    'driver'
);


--
-- Name: verification_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_request_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: verification_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_tier AS ENUM (
    'unverified',
    'bronze',
    'silver',
    'gold'
);


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_role_check CHECK (((role)::text = ANY ((ARRAY['super'::character varying, 'moderator'::character varying])::text[])))
);


--
-- Name: artisans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artisans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    skills text[],
    portfolio jsonb,
    experience_years integer,
    service_area text,
    verified_docs jsonb,
    premium boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    service_place_id text,
    service_lat numeric,
    service_lng numeric
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    buyer_id uuid,
    farmer_user_id uuid,
    driver_user_id uuid,
    pickup_location text,
    dropoff_location text,
    fee numeric DEFAULT 0 NOT NULL,
    status public.delivery_status DEFAULT 'created'::public.delivery_status NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    picked_up_at timestamp with time zone,
    on_the_way_at timestamp with time zone,
    delivered_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    dropoff_place_id text,
    dropoff_lat numeric,
    dropoff_lng numeric
);


--
-- Name: delivery_location_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_location_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id uuid,
    driver_user_id uuid,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    accuracy numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    escrow_id uuid,
    raised_by_user_id uuid,
    reason character varying(64) NOT NULL,
    details text,
    status public.dispute_status DEFAULT 'open'::public.dispute_status NOT NULL,
    resolution jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    evidence jsonb,
    resolved_by uuid,
    resolved_at timestamp with time zone
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    vehicle_type character varying(32) DEFAULT 'bike'::character varying,
    area_of_operation text,
    status public.driver_status DEFAULT 'pending'::public.driver_status NOT NULL,
    trust_score numeric(3,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: escrow_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escrow_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.escrow_type NOT NULL,
    buyer_id uuid,
    counterparty_user_id uuid,
    job_id uuid,
    order_id uuid,
    amount numeric NOT NULL,
    currency character varying(8) DEFAULT 'GHS'::character varying,
    platform_fee numeric DEFAULT 0,
    status public.escrow_status DEFAULT 'pending_payment'::public.escrow_status NOT NULL,
    provider character varying(32),
    provider_ref character varying(128),
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT escrow_one_fk CHECK ((((type = 'job'::public.escrow_type) AND (job_id IS NOT NULL) AND (order_id IS NULL)) OR ((type = 'order'::public.escrow_type) AND (order_id IS NOT NULL) AND (job_id IS NULL))))
);


--
-- Name: farmers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farmers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    farm_location text,
    farm_type text[],
    verified_docs jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    farm_place_id text,
    farm_lat numeric,
    farm_lng numeric
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    description text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid,
    title character varying(255),
    description text,
    location text,
    budget numeric,
    status public.job_status DEFAULT 'open'::public.job_status,
    assigned_artisan_id uuid,
    accepted_quote numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    image_url text,
    location_place_id text,
    location_lat numeric,
    location_lng numeric,
    started_at timestamp with time zone,
    provider_completed_at timestamp with time zone,
    buyer_confirmed_at timestamp with time zone,
    media jsonb,
    category text
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid,
    receiver_id uuid,
    job_id uuid,
    order_id uuid,
    message text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    buyer_id uuid,
    farmer_id uuid,
    quantity integer,
    total_price numeric,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    order_status public.order_status DEFAULT 'pending'::public.order_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    delivery_address text,
    delivery_fee numeric DEFAULT 0,
    delivery_place_id text,
    delivery_lat numeric,
    delivery_lng numeric
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    amount numeric NOT NULL,
    currency character varying(8) DEFAULT 'GHS'::character varying,
    method character varying(32) NOT NULL,
    method_details jsonb,
    status public.payout_status DEFAULT 'pending'::public.payout_status NOT NULL,
    provider character varying(32),
    provider_ref character varying(128),
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: policy_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    kind character varying(64) NOT NULL,
    context_type character varying(16),
    context_id uuid,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    farmer_id uuid,
    name character varying(255),
    category character varying(100),
    quantity integer,
    unit character varying(50),
    price numeric,
    auction_start_price numeric,
    status public.product_status DEFAULT 'available'::public.product_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    image_url text,
    media jsonb
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    artisan_id uuid,
    quote_amount numeric,
    message text,
    status public.quote_status DEFAULT 'pending'::public.quote_status,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reviewer_id uuid,
    target_id uuid,
    rating numeric(2,1),
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    job_id uuid,
    order_id uuid
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type character varying(64) NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    "interval" character varying(16) DEFAULT 'weekly'::character varying NOT NULL,
    renewal_date date,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid,
    user_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    body text,
    media jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    bio text,
    links jsonb,
    cover_photo text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    verified boolean DEFAULT false,
    rating numeric(2,1) DEFAULT 0,
    profile_pic character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_active_at timestamp with time zone,
    trust_score numeric(3,2) DEFAULT 0
);


--
-- Name: verification_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    level public.verification_tier DEFAULT 'unverified'::public.verification_tier NOT NULL,
    evidence jsonb,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: verification_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    requested_level public.verification_tier NOT NULL,
    status public.verification_request_status DEFAULT 'pending'::public.verification_request_status NOT NULL,
    evidence jsonb,
    note text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    balance numeric DEFAULT 0,
    currency character varying(8) DEFAULT 'GHS'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(32) NOT NULL,
    event_id character varying(128) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin admin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_pkey PRIMARY KEY (id);


--
-- Name: admin admin_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_user_id_key UNIQUE (user_id);


--
-- Name: artisans artisans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artisans
    ADD CONSTRAINT artisans_pkey PRIMARY KEY (id);


--
-- Name: artisans artisans_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artisans
    ADD CONSTRAINT artisans_user_id_key UNIQUE (user_id);


--
-- Name: deliveries deliveries_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_key UNIQUE (order_id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: delivery_location_updates delivery_location_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_updates
    ADD CONSTRAINT delivery_location_updates_pkey PRIMARY KEY (id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


--
-- Name: escrow_transactions escrow_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_pkey PRIMARY KEY (id);


--
-- Name: farmers farmers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmers
    ADD CONSTRAINT farmers_pkey PRIMARY KEY (id);


--
-- Name: farmers farmers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmers
    ADD CONSTRAINT farmers_user_id_key UNIQUE (user_id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: policy_events policy_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_events
    ADD CONSTRAINT policy_events_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_post_comments user_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_comments
    ADD CONSTRAINT user_post_comments_pkey PRIMARY KEY (id);


--
-- Name: user_post_likes user_post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_likes
    ADD CONSTRAINT user_post_likes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: user_posts user_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_posts
    ADD CONSTRAINT user_posts_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_levels verification_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_levels
    ADD CONSTRAINT verification_levels_pkey PRIMARY KEY (id);


--
-- Name: verification_levels verification_levels_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_levels
    ADD CONSTRAINT verification_levels_user_id_key UNIQUE (user_id);


--
-- Name: verification_requests verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT verification_requests_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_provider_event_id_key UNIQUE (provider, event_id);


--
-- Name: idx_artisans_service_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artisans_service_lat ON public.artisans USING btree (service_lat);


--
-- Name: idx_artisans_service_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artisans_service_lng ON public.artisans USING btree (service_lng);


--
-- Name: idx_deliveries_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_driver ON public.deliveries USING btree (driver_user_id);


--
-- Name: idx_deliveries_dropoff_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_dropoff_lat ON public.deliveries USING btree (dropoff_lat);


--
-- Name: idx_deliveries_dropoff_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_dropoff_lng ON public.deliveries USING btree (dropoff_lng);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (status);


--
-- Name: idx_delivery_loc_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_loc_delivery ON public.delivery_location_updates USING btree (delivery_id, created_at DESC);


--
-- Name: idx_delivery_loc_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_loc_driver ON public.delivery_location_updates USING btree (driver_user_id, created_at DESC);


--
-- Name: idx_disputes_raised_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_raised_by ON public.disputes USING btree (raised_by_user_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (status);


--
-- Name: idx_escrow_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_buyer ON public.escrow_transactions USING btree (buyer_id);


--
-- Name: idx_escrow_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_job ON public.escrow_transactions USING btree (job_id);


--
-- Name: idx_escrow_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_order ON public.escrow_transactions USING btree (order_id);


--
-- Name: idx_escrow_provider_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escrow_provider_ref ON public.escrow_transactions USING btree (provider, provider_ref);


--
-- Name: idx_farmers_farm_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_farmers_farm_lat ON public.farmers USING btree (farm_lat);


--
-- Name: idx_farmers_farm_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_farmers_farm_lng ON public.farmers USING btree (farm_lng);


--
-- Name: idx_feature_flags_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_flags_enabled ON public.feature_flags USING btree (enabled);


--
-- Name: idx_jobs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_category ON public.jobs USING btree (category);


--
-- Name: idx_jobs_location_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_location_lat ON public.jobs USING btree (location_lat);


--
-- Name: idx_jobs_location_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_location_lng ON public.jobs USING btree (location_lng);


--
-- Name: idx_messages_job_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_job_created ON public.messages USING btree (job_id, created_at);


--
-- Name: idx_messages_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_order_created ON public.messages USING btree (order_id, created_at);


--
-- Name: idx_messages_receiver_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_receiver_read ON public.messages USING btree (receiver_id, read);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_orders_delivery_lat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_delivery_lat ON public.orders USING btree (delivery_lat);


--
-- Name: idx_orders_delivery_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_delivery_lng ON public.orders USING btree (delivery_lng);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);


--
-- Name: idx_payouts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_user ON public.payouts USING btree (user_id);


--
-- Name: idx_policy_events_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_events_kind ON public.policy_events USING btree (kind, created_at DESC);


--
-- Name: idx_policy_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_events_user ON public.policy_events USING btree (user_id, created_at DESC);


--
-- Name: idx_post_comments_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_comments_post ON public.user_post_comments USING btree (post_id, created_at);


--
-- Name: idx_post_likes_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_likes_post ON public.user_post_likes USING btree (post_id, created_at DESC);


--
-- Name: idx_reviews_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_target ON public.reviews USING btree (target_id, created_at DESC);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_user_posts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_posts_user ON public.user_posts USING btree (user_id, created_at DESC);


--
-- Name: idx_users_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_active ON public.users USING btree (last_active_at DESC);


--
-- Name: idx_verification_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_requests_status ON public.verification_requests USING btree (status, created_at DESC);


--
-- Name: uq_disputes_active_per_escrow; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_disputes_active_per_escrow ON public.disputes USING btree (escrow_id) WHERE (status = ANY (ARRAY['open'::public.dispute_status, 'under_review'::public.dispute_status]));


--
-- Name: uq_reviews_job_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_reviews_job_reviewer ON public.reviews USING btree (reviewer_id, job_id) WHERE (job_id IS NOT NULL);


--
-- Name: uq_reviews_order_reviewer_target; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_reviews_order_reviewer_target ON public.reviews USING btree (reviewer_id, order_id, target_id) WHERE (order_id IS NOT NULL);


--
-- Name: uq_verification_requests_pending_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_verification_requests_pending_user ON public.verification_requests USING btree (user_id) WHERE (status = 'pending'::public.verification_request_status);


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: artisans artisans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artisans
    ADD CONSTRAINT artisans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deliveries deliveries_driver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_driver_user_id_fkey FOREIGN KEY (driver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deliveries deliveries_farmer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_farmer_user_id_fkey FOREIGN KEY (farmer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deliveries deliveries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: delivery_location_updates delivery_location_updates_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_updates
    ADD CONSTRAINT delivery_location_updates_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;


--
-- Name: delivery_location_updates delivery_location_updates_driver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_updates
    ADD CONSTRAINT delivery_location_updates_driver_user_id_fkey FOREIGN KEY (driver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: disputes disputes_escrow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_escrow_id_fkey FOREIGN KEY (escrow_id) REFERENCES public.escrow_transactions(id) ON DELETE CASCADE;


--
-- Name: disputes disputes_raised_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_raised_by_user_id_fkey FOREIGN KEY (raised_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: disputes disputes_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: escrow_transactions escrow_transactions_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: escrow_transactions escrow_transactions_counterparty_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_counterparty_user_id_fkey FOREIGN KEY (counterparty_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: escrow_transactions escrow_transactions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: escrow_transactions escrow_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow_transactions
    ADD CONSTRAINT escrow_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: farmers farmers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmers
    ADD CONSTRAINT farmers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: feature_flags feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_assigned_artisan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_assigned_artisan_id_fkey FOREIGN KEY (assigned_artisan_id) REFERENCES public.artisans(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: messages messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE SET NULL;


--
-- Name: orders orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: policy_events policy_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_events
    ADD CONSTRAINT policy_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: products products_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_artisan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_artisan_id_fkey FOREIGN KEY (artisan_id) REFERENCES public.artisans(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_post_comments user_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_comments
    ADD CONSTRAINT user_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.user_posts(id) ON DELETE CASCADE;


--
-- Name: user_post_comments user_post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_comments
    ADD CONSTRAINT user_post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_post_likes user_post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_likes
    ADD CONSTRAINT user_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.user_posts(id) ON DELETE CASCADE;


--
-- Name: user_post_likes user_post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_post_likes
    ADD CONSTRAINT user_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_posts user_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_posts
    ADD CONSTRAINT user_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_levels verification_levels_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_levels
    ADD CONSTRAINT verification_levels_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_levels verification_levels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_levels
    ADD CONSTRAINT verification_levels_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_requests verification_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_requests verification_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT verification_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict AUHoe5hWBeb4UlyHy34j03pdqV0Ey7bc6cf2iHEkoHFr4OwunwLrP4URV7Torst

