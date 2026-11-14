"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function PurchaseButton({
  listingId,
  sold = false,
}: {
  listingId: string;
  sold?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [isSold, setSold] = useState(sold);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (sold) return;
    const controller = new AbortController();
    fetch(`/api/stripe/availability/?listing_id=${listingId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const value = await response.json();
        setAvailable(value.purchasable);
        setSold(value.sold);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [listingId, sold]);
  async function buy() {
    setBusy(true);
    setError("");
    try {
      const key = `checkout-${listingId}`;
      const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, requestId);
      const response = await fetch("/api/stripe/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, requestId }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 410) sessionStorage.removeItem(key);
        throw new Error(result.error || "Could not start checkout.");
      }
      window.location.assign(result.url);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="purchase-box">
      {isSold ? (
        <strong className="sold-label">Sold</strong>
      ) : available ? (
        <>
          <Button onClick={buy} disabled={busy}>
            {busy ? "Opening Stripe…" : "Buy Now"}
          </Button>
          <p>Secure checkout with Stripe.</p>
        </>
      ) : (
        <p>Online checkout is not available for this item.</p>
      )}
      {error && (
        <p role="alert" className="payment-error">
          {error}
        </p>
      )}
    </div>
  );
}
