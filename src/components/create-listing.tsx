"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Check,
  ImagePlus,
  MapPin,
  Package,
  ShieldCheck,
  Tag,
  X,
  Eye,
} from "lucide-react";
import { DemoBanner, Header } from "./shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { categories, createListing, money, supabase } from "@/lib/marketplace";
export function CreateListing() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Palo Alto, CA");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(f?: File) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Please choose a photo smaller than 5 MB.");
      return;
    }
    setFile(f);
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Add a photo of your item before publishing.");
      return;
    }
    if (!title.trim() || !description.trim() || !category || !location.trim()) {
      setError("Please complete all listing details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const listing = await createListing(
        {
          title: title.trim(),
          price: Number(price),
          seller_email: email.trim(),
          category,
          description: description.trim(),
          location: location.trim(),
        },
        file,
      );
      router.push("/listing/?id=" + listing.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save the listing. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="create-main">
        <aside className="create-sidebar">
          <Link href="/" className="back-link">
            <ArrowLeft size={16} /> Back to Marketplace
          </Link>
          <div className="section-eyebrow">MAKE ROOM FOR SOMETHING NEW</div>
          <h1>Create a listing</h1>
          <p>Your next chapter starts with a little more space.</p>
          <div className={"step-item " + (step === 0 ? "current" : "complete")}>
            <span>{step > 0 ? <Check size={15} /> : 1}</span>
            <div>
              <strong>Choose listing type</strong>
              <p>What would you like to sell?</p>
            </div>
          </div>
          <div className={"step-item " + (step === 1 ? "current" : "")}>
            <span>2</span>
            <div>
              <strong>Add the details</strong>
              <p>Make your item stand out</p>
            </div>
          </div>
          <div className="selling-tip">
            <ShieldCheck size={22} />
            <h3>A good listing goes a long way.</h3>
            <p>
              Use a clear photo, an honest description, and a fair price. Your
              next buyer could be just around the corner.
            </p>
          </div>
        </aside>
        <div className="create-content">
          <DemoBanner />
          {step === 0 ? (
            <section className="choose-type">
              <span className="section-eyebrow">
                A FRESH START FOR YOUR PRE-LOVED THINGS
              </span>
              <h2>What are you listing?</h2>
              <p>From everyday essentials to unexpected treasures.</p>
              <div className="type-grid">
                {[
                  {
                    name: "Item for sale",
                    description:
                      "Furniture, electronics, and everything in between.",
                    icon: Package,
                    category: "",
                  },
                  {
                    name: "Vehicle for sale",
                    description:
                      "Find a new driver for your next set of wheels.",
                    icon: Bike,
                    category: "Vehicles",
                  },
                  {
                    name: "Home for sale or rent",
                    description:
                      "Help someone find their next place to call home.",
                    icon: Building2,
                    category: "Property Rentals",
                  },
                ].map((t) => (
                  <button
                    key={t.name}
                    className="type-card"
                    onClick={() => {
                      setCategory(t.category);
                      setStep(1);
                    }}
                  >
                    <span className="type-icon">
                      <t.icon size={29} />
                    </span>
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                    <span className="type-arrow">
                      <ArrowRight size={19} />
                    </span>
                  </button>
                ))}
              </div>
              <p className="choose-note">
                <Tag size={15} /> It’s free to list. Good things deserve a
                second home.
              </p>
            </section>
          ) : (
            <>
              <div className="editor-heading">
                <div>
                  <button className="back-link" onClick={() => setStep(0)}>
                    <ArrowLeft size={15} /> Listing type
                  </button>
                  <h2>Tell us about your item</h2>
                  <p>A few details today. Someone’s favorite find tomorrow.</p>
                </div>
                <span className="preview-label">
                  <Eye size={16} /> Live preview
                </span>
              </div>
              <div className="editor-grid">
                <form className="listing-form" onSubmit={submit}>
                  <div
                    className={"upload-area " + (preview ? "has-image" : "")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      choose(e.dataTransfer.files[0]);
                    }}
                  >
                    {preview ? (
                      <>
                        <img src={preview} alt="Your listing photo" />
                        <button
                          type="button"
                          className="remove-image"
                          onClick={() => {
                            setFile(null);
                            if (inputRef.current) inputRef.current.value = "";
                          }}
                          aria-label="Remove photo"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                      >
                        <span>
                          <ImagePlus size={24} />
                        </span>
                        <strong>Add a photo</strong>
                        <p>or drag and drop it here</p>
                        <small>JPG, PNG, WebP · Up to 5 MB</small>
                      </button>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label="Listing photo"
                      onChange={(e) => choose(e.target.files?.[0])}
                    />
                  </div>
                  <label htmlFor="title">
                    Title <span>*</span>
                  </label>
                  <Input
                    id="title"
                    required
                    maxLength={255}
                    placeholder="What are you selling?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <div className="field-pair">
                    <div>
                      <label htmlFor="price">
                        Price <span>*</span>
                      </label>
                      <div className="price-input">
                        <span>$</span>
                        <Input
                          id="price"
                          type="number"
                          required
                          min="0"
                          max="99999999.99"
                          step="0.01"
                          placeholder="0.00"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="category">
                        Category <span>*</span>
                      </label>
                      <select
                        id="category"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="" disabled>
                          Select category
                        </option>
                        {categories.slice(1).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label htmlFor="email">
                    Seller email <span>*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    maxLength={255}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <label htmlFor="description">
                    Description <span>*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    maxLength={5000}
                    placeholder="Share the details — condition, size, and what makes it special."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <label htmlFor="location">
                    Location <span>*</span>
                  </label>
                  <Input
                    id="location"
                    required
                    maxLength={255}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <p className="form-disclosure">
                    Your email will be visible on your listing so buyers can
                    contact you.
                  </p>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <Button className="w-full publish-button" disabled={busy}>
                    {busy
                      ? "Publishing…"
                      : supabase
                        ? "Publish listing"
                        : "Publish demo listing"}
                    <ArrowRight size={17} />
                  </Button>
                  <p className="message-note">
                    {supabase
                      ? "Your listing will be visible to everyone on Marketplace."
                      : "Demo listings are saved in this browser only."}
                  </p>
                </form>
                <div className="live-preview">
                  <div className="preview-photo">
                    {preview ? (
                      <img src={preview} alt="Live preview of your item" />
                    ) : (
                      <div>
                        <ImagePlus size={42} />
                        <p>Your photo goes here</p>
                      </div>
                    )}
                  </div>
                  <div className="preview-details">
                    <span className="preview-category">
                      {category || "Your category"}
                    </span>
                    <h3>{title || "Your listing title"}</h3>
                    <strong className="preview-price">
                      {price ? money(Number(price)) : "$0"}
                    </strong>
                    <p className="detail-location">
                      <MapPin size={14} />
                      {location || "Your location"}
                    </p>
                    <div className="detail-divider" />
                    <h4>Description</h4>
                    <p className="preview-description">
                      {description ||
                        "Tell buyers a little about your item. Your description will appear here."}
                    </p>
                    <div className="preview-seller">
                      <span className="seller-avatar">
                        {email ? email[0].toUpperCase() : "Y"}
                      </span>
                      <div>
                        <strong>Seller information</strong>
                        <p>{email || "Your email address"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="preview-footnote">
                    This is how buyers will see your listing.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
