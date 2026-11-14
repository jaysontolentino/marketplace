import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  adminDb: vi.fn(),
  stripeClient: vi.fn(),
  syncSeller: vi.fn(),
}));
vi.mock("@/lib/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments")>()),
  ...mocks,
}));
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { GET as receipt } from "@/app/api/stripe/order/route";
import { GET as availability } from "@/app/api/stripe/availability/route";

const id = "10000000-0000-4000-8000-000000000001";
const orderId = "20000000-0000-4000-8000-000000000001";
const secret = "whsec_unit_test";
const sdk = new Stripe("sk_test_unit");
const order = {
  id: orderId,
  listing_id: id,
  listing_title: "Chair",
  amount_total: 12550,
  platform_fee: 1255,
  currency: "usd",
  seller_account_id: "acct_seller",
  stripe_session_id: "cs_test_abc123",
  status: "pending",
  created_at: new Date().toISOString(),
};
function database(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "update", "insert"])
    chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: rows.shift(), error: null }));
  chain.then = vi.fn((resolve) => resolve({ error: null }));
  const db = {
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => ({ data: order, error: null })),
  };
  mocks.adminDb.mockReturnValue(db);
  return { db, chain };
}
function event(
  type: string,
  object: object,
  account: string | undefined = "acct_seller",
) {
  const body = JSON.stringify({
    id: "evt_unit",
    object: "event",
    type,
    account,
    data: { object },
  });
  const signature = sdk.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return new Request("http://localhost:3000/api/stripe/webhook/", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}
function checkoutRequest(extra = {}, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/stripe/checkout/", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ listingId: id, requestId: orderId, ...extra }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mocks.stripeClient.mockReturnValue(sdk);
  mocks.syncSeller.mockResolvedValue(true);
});

describe("signed Connect webhook", () => {
  const paid = {
    id: "cs_test_abc123",
    metadata: { order_id: orderId },
    payment_status: "paid",
    amount_total: 12550,
    currency: "usd",
    payment_intent: "pi_test",
    customer_details: { email: "buyer@example.com" },
  };
  it("rejects missing and forged signatures before touching the database", async () => {
    const missing = await webhook(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(missing.status).toBe(400);
    const forged = event("checkout.session.completed", paid);
    forged.headers.set("stripe-signature", "t=1,v1=bad");
    expect((await webhook(forged)).status).toBe(400);
    expect(mocks.adminDb).not.toHaveBeenCalled();
  });
  it("passes paid orders to the atomic confirmation function", async () => {
    const { db } = database([order]);
    expect(
      (await webhook(event("checkout.session.completed", paid))).status,
    ).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith(
      "confirm_checkout",
      expect.objectContaining({
        p_order_id: orderId,
        p_amount: 12550,
        p_account_id: "acct_seller",
        p_buyer_email: "buyer@example.com",
      }),
    );
  });
  it("ignores other candidates' orders and wrong connected accounts", async () => {
    const { db } = database([null, order]);
    expect(
      (await webhook(event("checkout.session.completed", paid))).status,
    ).toBe(200);
    expect(
      (await webhook(event("checkout.session.completed", paid, "acct_other")))
        .status,
    ).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("ignores unpaid sessions and events without a Connect account", async () => {
    const { db } = database([order]);
    expect(
      (
        await webhook(
          event("checkout.session.completed", {
            ...paid,
            payment_status: "unpaid",
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await webhook(event("checkout.session.completed", paid, ""))).status,
    ).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("ignores mismatched session IDs", async () => {
    const { db } = database([{ ...order, stripe_session_id: "cs_other" }]);
    expect(
      (await webhook(event("checkout.session.completed", paid))).status,
    ).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("returns a retryable error if atomic confirmation fails", async () => {
    const { db } = database([order]);
    db.rpc.mockResolvedValue({
      data: null as never,
      error: { message: "database unavailable" } as never,
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (await webhook(event("checkout.session.completed", paid))).status,
    ).toBe(503);
    log.mockRestore();
  });
  it("releases only pending orders on expiry", async () => {
    const { chain } = database([order]);
    expect(
      (await webhook(event("checkout.session.expired", paid))).status,
    ).toBe(200);
    expect(chain.update).toHaveBeenCalledWith({
      status: "expired",
      stripe_session_id: paid.id,
    });
    expect(chain.eq).toHaveBeenCalledWith("status", "pending");
  });
  it("refreshes only the account supplied by a verified account event", async () => {
    expect(
      (await webhook(event("account.updated", { id: "acct_seller" }))).status,
    ).toBe(200);
    expect(mocks.syncSeller).toHaveBeenCalledWith("acct_seller");
  });
});

describe("checkout server authority", () => {
  it("ignores client price, fee and account values, using a direct charge and stable idempotency key", async () => {
    database([null]);
    const create = vi
      .fn()
      .mockResolvedValue({
        id: "cs_test_abc123",
        url: "https://checkout.stripe.com/test",
      });
    mocks
      .adminDb()
      .rpc.mockResolvedValue({
        data: { ...order, stripe_session_id: null },
        error: null,
      });
    mocks.stripeClient.mockReturnValue({ checkout: { sessions: { create } } });
    const response = await checkout(
      checkoutRequest({
        amount: 1,
        platform_fee: 0,
        seller_account_id: "acct_attacker",
      }),
    );
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed_payment_method_types: ["card"],
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 1255,
        }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 12550,
              product_data: { name: "Chair" },
            },
          },
        ],
      }),
      { stripeAccount: "acct_seller", idempotencyKey: `checkout-${orderId}` },
    );
  });
  it("rejects foreign origins and invalid IDs before accessing the database", async () => {
    expect(
      (await checkout(checkoutRequest({}, "https://attacker.example"))).status,
    ).toBe(403);
    expect(
      (await checkout(checkoutRequest({ listingId: "fake" }))).status,
    ).toBe(400);
    expect(mocks.adminDb).not.toHaveBeenCalled();
  });
  it("rejects a second buyer with an active reservation", async () => {
    database([{ ...order, id: "other-order" }]);
    mocks.stripeClient.mockReturnValue({
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue({ status: "open" }) },
      },
    });
    expect((await checkout(checkoutRequest())).status).toBe(409);
  });
});

describe("availability and receipts", () => {
  it("does not offer checkout before onboarding or for a sold listing", async () => {
    for (const seller of [
      null,
      {
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      },
    ]) {
      database([
        {
          seller_email: "seller@example.com",
          status: "available",
          price: 125.5,
        },
        seller,
      ]);
      const response = await availability(
        new Request(
          `http://localhost/api/stripe/availability/?listing_id=${id}`,
        ),
      );
      expect((await response.json()).purchasable).toBe(false);
    }
    database([
      { seller_email: "seller@example.com", status: "sold", price: 125.5 },
      { charges_enabled: true, payouts_enabled: true, details_submitted: true },
    ]);
    const data = await (
      await availability(
        new Request(
          `http://localhost/api/stripe/availability/?listing_id=${id}`,
        ),
      )
    ).json();
    expect(data).toEqual({ sold: true, purchasable: false });
  });
  it("shows a paid Stripe session as pending until the webhook confirms it", async () => {
    const { db } = database([order]);
    mocks.stripeClient.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({ payment_status: "paid" }),
        },
      },
    });
    const response = await receipt(
      new Request(
        "http://localhost/api/stripe/order/?session_id=cs_test_abc123",
      ),
    );
    expect(await response.json()).toMatchObject({
      status: "pending",
      paymentReceived: true,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
