"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Tag,
  Clock,
  Mail,
  Share2,
} from "lucide-react";
import { Header } from "./shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ListingImage } from "./listing-image";
import { PurchaseButton } from "./purchase-button";
import { getListing, Listing, money, sendMessage } from "@/lib/marketplace";
export function ListingDetail() {
  const params = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("Hi! Is this still available?");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = params.get("id");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setListing(null);
    setError("");
    setSent(false);
    setCopied(false);
    if (!id) {
      setLoading(false);
      return;
    }
    getListing(id)
      .then((value) => {
        if (active) setListing(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!listing || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(listing, email.trim(), message.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <Header />
      <main className="detail-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={17} /> Back to Marketplace
        </Link>
        {loading ? (
          <div className="detail-skeleton skeleton" />
        ) : !listing ? (
          <div className="empty-state">
            <h1>{error ? "Unable to load listing" : "Listing not found"}</h1>
            <p>{error || "This item may no longer be available."}</p>
            <Button asChild>
              <Link href="/">Explore other finds</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="detail-breadcrumb">
              Marketplace <span>/</span> {listing.category} <span>/</span>{" "}
              {listing.title}
            </div>
            <div className="detail-grid">
              <div className="detail-photo">
                <ListingImage src={listing.image_url} title={listing.title} />
                {listing.image_url && (
                  <span className="photo-count">1 / 1</span>
                )}
              </div>
              <section className="detail-information">
                <div className="detail-category">
                  <Tag size={14} />
                  {listing.category}
                  <span
                    className={
                      listing.status === "sold" ? "sold-label" : "available-dot"
                    }
                  >
                    {listing.status === "sold" ? "Sold" : "Available"}
                  </span>
                </div>
                <h1>{listing.title}</h1>
                <div className="detail-price">{money(listing.price)}</div>
                <PurchaseButton
                  listingId={listing.id}
                  sold={listing.status === "sold"}
                />
                {params.get("checkout") === "cancelled" && (
                  <p role="status">
                    Checkout was cancelled. Your item has not been purchased.
                    You can resume using Buy Now.
                  </p>
                )}
                <p className="detail-location">
                  <MapPin size={15} />
                  {listing.location || "Location not specified"}
                </p>
                <p className="detail-date">
                  <Clock size={14} /> Listed{" "}
                  {new Date(listing.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="detail-divider" />
                <h2>About this item</h2>
                <p className="item-description">
                  {listing.description ||
                    "The seller hasn’t added a description yet."}
                </p>
                <div className="detail-divider" />
                <h2>Meet your seller</h2>
                <div className="seller-profile">
                  <span className="seller-avatar">
                    {listing.seller_email[0].toUpperCase()}
                  </span>
                  <div>
                    <strong>{listing.seller_email.split("@")[0]}</strong>
                    <a href={"mailto:" + listing.seller_email}>
                      <Mail size={12} />
                      {listing.seller_email}
                    </a>
                  </div>
                </div>
                <form className="message-box" onSubmit={submit}>
                  <h3>
                    <MessageCircle size={18} />
                    Message seller
                  </h3>
                  {sent ? (
                    <div className="message-success" role="status">
                      <Check size={22} />
                      <strong>Your message has been sent!</strong>
                      <p>
                        Your message has been saved for the seller. Your email
                        is included so they can reply.
                      </p>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setSent(false)}
                      >
                        Send another message
                      </Button>
                    </div>
                  ) : (
                    <>
                      <label htmlFor="buyer-email">Your email</label>
                      <Input
                        id="buyer-email"
                        type="email"
                        required
                        maxLength={255}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <label htmlFor="buyer-message">Your message</label>
                      <textarea
                        id="buyer-message"
                        required
                        minLength={1}
                        maxLength={5000}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                      {error && (
                        <p className="form-error" role="alert">
                          {error}
                        </p>
                      )}
                      <Button
                        className="w-full"
                        disabled={sending || !message.trim()}
                      >
                        {sending ? "Sending…" : "Send message"}
                        <ArrowUpRight size={17} />
                      </Button>
                      <p className="message-note">
                        Your email is shared with the seller so they can reply.
                      </p>
                    </>
                  )}
                </form>
                <div className="safety-note">
                  <ShieldCheck size={18} />
                  <p>
                    Keep it local. Meet in a public place and check the item
                    before paying.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="share-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                    } catch {
                      setError(
                        "Could not copy the link. Copy the address from your browser.",
                      );
                    }
                  }}
                >
                  <Share2 size={16} />
                  {copied ? "Link copied" : "Share this listing"}
                </Button>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
