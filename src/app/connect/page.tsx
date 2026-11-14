"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ConnectPage() {
  const [email, setEmail] = useState("");
  const [seller, setSeller] = useState<{
    email: string;
    ready: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/stripe/connect/", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.seller) {
          setSeller(data.seller);
          setEmail(data.seller.email);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not connect to Stripe.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="payment-page">
        <Link href="/" className="back-link">
          ← Back to Marketplace
        </Link>
        <section className="payment-card">
          <div className="eyebrow">START SELLING</div>
          <h1>Get paid with Stripe</h1>
          <p>
            Connect your Stripe account to accept payments on every listing with
            your seller email. No marketplace login needed.
          </p>
          <p>
            The marketplace fee is 10% per sale. Stripe processing fees also
            apply.
          </p>
          {seller?.ready && (
            <div className="payment-success" role="status">
              Stripe is connected for {seller.email}. Your eligible listings can
              now accept payments.
            </div>
          )}
          {seller && !seller.ready && (
            <p role="status">
              Your Stripe onboarding is incomplete. Continue to finish your
              details and enable payments.
            </p>
          )}
          <form onSubmit={submit}>
            <label htmlFor="seller-email">Seller email</label>
            <Input
              id="seller-email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="The email on your listings"
            />
            <Button disabled={busy} type="submit">
              {busy ? "Opening Stripe…" : "Connect with Stripe"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="payment-error">
              {error}
            </p>
          )}
          <Link href="/create/">Create a listing →</Link>
        </section>
      </main>
    </>
  );
}
