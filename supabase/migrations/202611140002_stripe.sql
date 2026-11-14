-- Apply after 202611140001_marketplace.sql. All payment writes are server-only.
ALTER TABLE public.listings ADD COLUMN status text NOT NULL DEFAULT 'available'
  CHECK (status IN ('available', 'sold'));

CREATE TABLE public.stripe_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  stripe_account_id text UNIQUE,
  connect_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id),
  seller_account_id text NOT NULL,
  listing_title text NOT NULL,
  amount_total integer NOT NULL CHECK (amount_total >= 50),
  platform_fee integer NOT NULL CHECK (platform_fee >= 0 AND platform_fee < amount_total),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  buyer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE UNIQUE INDEX orders_one_active_purchase ON public.orders(listing_id)
  WHERE status IN ('pending', 'paid');
ALTER TABLE public.stripe_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_sellers, public.orders FROM anon, authenticated;
GRANT ALL ON public.stripe_sellers, public.orders TO service_role;

-- Public listing creation cannot forge a sold status, and public clients cannot
-- change listing prices/status after a Checkout amount has been reserved.
DROP POLICY "Anyone can create listings" ON public.listings;
CREATE POLICY "Anyone can create listings" ON public.listings FOR INSERT
  WITH CHECK (status = 'available');
DROP POLICY "Users can update their own listings" ON public.listings;

CREATE FUNCTION public.reserve_checkout(p_listing_id uuid, p_order_id uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item public.listings; seller public.stripe_sellers; purchase public.orders; cents integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND status = 'expired') THEN
    RAISE EXCEPTION 'Checkout expired';
  END IF;
  SELECT * INTO item FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR item.status <> 'available' THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
  SELECT * INTO seller FROM public.stripe_sellers WHERE email = lower(trim(item.seller_email));
  IF NOT FOUND OR NOT (seller.charges_enabled AND seller.payouts_enabled AND seller.details_submitted)
    OR seller.stripe_account_id IS NULL THEN RAISE EXCEPTION 'Seller is not ready'; END IF;
  SELECT * INTO purchase FROM public.orders WHERE listing_id = item.id AND status IN ('pending', 'paid');
  IF FOUND THEN
    IF purchase.id = p_order_id AND purchase.status = 'pending' THEN RETURN purchase; END IF;
    RAISE EXCEPTION 'This item is already reserved for checkout';
  END IF;
  cents := round(item.price * 100)::integer;
  IF cents < 50 OR cents > 99999999 THEN RAISE EXCEPTION 'Price must be between $0.50 and $999,999.99'; END IF;
  INSERT INTO public.orders(id, listing_id, seller_account_id, listing_title, amount_total, platform_fee)
    VALUES(p_order_id, item.id, seller.stripe_account_id, item.title, cents, round(cents * 0.10)::integer)
    RETURNING * INTO purchase;
  RETURN purchase;
END;
$$;

-- A single transaction makes retries idempotent and updates the order and item together.
CREATE FUNCTION public.confirm_checkout(p_order_id uuid, p_session_id text, p_account_id text,
  p_amount integer, p_currency text, p_payment_intent text, p_buyer_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase public.orders;
BEGIN
  SELECT * INTO purchase FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF purchase.seller_account_id IS DISTINCT FROM p_account_id OR purchase.amount_total IS DISTINCT FROM p_amount
    OR purchase.currency IS DISTINCT FROM p_currency OR p_session_id IS NULL OR p_payment_intent IS NULL
    OR (purchase.stripe_session_id IS NOT NULL AND purchase.stripe_session_id <> p_session_id)
    THEN RAISE EXCEPTION 'Payment does not match order'; END IF;
  IF purchase.status = 'paid' THEN RETURN; END IF;
  IF purchase.status <> 'pending' THEN RAISE EXCEPTION 'Order no longer pending'; END IF;
  UPDATE public.orders SET status = 'paid', stripe_session_id = p_session_id,
    stripe_payment_intent_id = p_payment_intent, buyer_email = p_buyer_email, paid_at = now()
    WHERE id = purchase.id;
  UPDATE public.listings SET status = 'sold' WHERE id = purchase.listing_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_checkout(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_checkout(uuid, text, text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_checkout(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_checkout(uuid, text, text, integer, text, text, text) TO service_role;
