"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/shell";
import { money } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";

type Receipt = {
  id: string;
  listing_id: string;
  listing_title: string;
  amount_total: number;
  status: string;
  paymentReceived: boolean;
};
function Confirmation() {
  const session = useSearchParams().get("session_id");
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const controller = new AbortController();
    setError("");
    setWaiting(false);
    async function poll() {
      try {
        const response = await fetch(
          `/api/stripe/order/?session_id=${encodeURIComponent(session!)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load your order.");
        if (!active) return;
        setOrder(data);
        if (data.status === "pending") {
          if (++attempts < 30) timer = setTimeout(poll, 2000);
          else setWaiting(true);
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your order.",
          );
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [session, retry]);
  const confirmed = order?.status === "paid";
  return (
    <section className="payment-card">
      <div className="eyebrow">YOUR ORDER</div>
      <h1>
        {confirmed
          ? "Thanks for your purchase!"
          : order?.paymentReceived
            ? "Payment received"
            : order?.status === "expired"
              ? "Checkout expired"
              : "Checking your payment"}
      </h1>
      {!session ? (
        <p role="alert">No checkout session was provided.</p>
      ) : error ? (
        <p className="payment-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <p role="status">
            {confirmed
              ? "Your order is confirmed and the listing is marked as sold."
              : order?.paymentReceived
                ? "Your payment succeeded. We’re waiting for Stripe’s confirmation to finish recording your order. You can safely leave this page."
                : order?.status === "expired"
                  ? "This checkout was not completed. Return to the listing to try again."
                  : "Waiting for Stripe to confirm your payment. Please don’t pay again."}
          </p>
          {order && (
            <div className="receipt">
              <strong>{order.listing_title}</strong>
              <span>{money(order.amount_total / 100)}</span>
              <small>Order {order.id}</small>
            </div>
          )}
        </>
      )}
      {(waiting || error) && (
        <>
          <p>Confirmation is taking longer than usual. Check again shortly.</p>
          <Button onClick={() => setRetry(retry + 1)}>Check again</Button>
        </>
      )}
      {order && (
        <Link href={`/listing/?id=${order.listing_id}`}>View your item →</Link>
      )}
      <Link href="/">Back to Marketplace</Link>
    </section>
  );
}
export default function SuccessPage() {
  return (
    <>
      <Header />
      <main className="payment-page">
        <Suspense fallback={<p>Loading your order…</p>}>
          <Confirmation />
        </Suspense>
      </main>
    </>
  );
}
