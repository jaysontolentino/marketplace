"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  Grid2X2,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
} from "lucide-react";
import { Header, Sidebar } from "./shell";
import { Button } from "./ui/button";
import { ListingImage } from "./listing-image";
import { categories, getListings, Listing, money } from "@/lib/marketplace";
export function Browse() {
  const params = useSearchParams();
  const [category, setCategory] = useState(
    params.get("category") || "All categories",
  );
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("newest");
  const [filters, setFilters] = useState(false);
  const [max, setMax] = useState("");
  useEffect(() => {
    getListings()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    try {
      setSaved(JSON.parse(localStorage.getItem("marketplace-saved") || "[]"));
    } catch {}
  }, []);
  function toggle(id: string) {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    localStorage.setItem("marketplace-saved", JSON.stringify(next));
  }
  function browseAll() {
    setSearch("");
    setCategory("All categories");
    setMax("");
    setSavedOnly(false);
    setFilters(false);
  }
  const filtered = items
    .filter(
      (l) =>
        (category === "All categories" || l.category === category) &&
        (!savedOnly || saved.includes(l.id)) &&
        (!max || l.price <= Number(max)) &&
        (l.title + " " + (l.description ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  return (
    <>
      <Header search={search} onSearch={setSearch} />
      <Sidebar
        category={category}
        saved={savedOnly}
        onBrowseAll={browseAll}
        browseAllActive={!search && !max}
        onSaved={() => setSavedOnly(!savedOnly)}
        onCategory={(c) => {
          setCategory(c);
          setSavedOnly(false);
        }}
      />
      <main className="browse-main">
        <section className="welcome-banner">
          <div>
            <div className="eyebrow">
              <span /> YOUR NEIGHBORHOOD, REDISCOVERED
            </div>
            <h2>
              Your next great find
              <br />
              is right around the corner<span>.</span>
            </h2>
            <p>Pre-loved things. New possibilities. All close to home.</p>
            <Link href="/create/">
              Have something to pass on?{" "}
              <strong>
                Start selling <ArrowUpRight size={16} />
              </strong>
            </Link>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-photo">
              <img
                src="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=500&q=85"
                alt=""
              />
              <span>
                <span className="green-dot" /> A new home awaits
              </span>
            </div>
            <div className="find-sticker">
              <Sparkles size={18} />
              <span>
                GOOD FINDS,
                <br />
                <b>GREAT PRICES.</b>
              </span>
            </div>
            <div className="floating-tag">Made for a second chapter ↗</div>
          </div>
        </section>
        <div className="browse-heading">
          <div>
            <div className="section-eyebrow">THE LOCAL EDIT</div>
            <h2>
              {savedOnly
                ? "Your saved finds"
                : category === "All categories"
                  ? "Today's picks"
                  : category}
              <span className="heading-dot" />
            </h2>
            <p>
              <MapPin size={14} /> Palo Alto, CA <span>·</span> Finds worth
              staying local for
            </p>
          </div>
          <Button variant="outline" onClick={() => setFilters(!filters)}>
            <SlidersHorizontal size={15} /> Filters
            {max && <span className="filter-count">1</span>}
          </Button>
        </div>
        <div className="browse-toolbar">
          <div className="category-tabs">
            {[
              "All categories",
              "Home Goods",
              "Electronics",
              "Apparel",
              "Sporting Goods",
            ].map((c) => (
              <button
                key={c}
                className={c === category ? "tab active" : "tab"}
                onClick={() => {
                  setCategory(c);
                  setSavedOnly(false);
                }}
              >
                {c === "All categories" ? "For you" : c}
              </button>
            ))}
            {![
              "All categories",
              "Home Goods",
              "Electronics",
              "Apparel",
              "Sporting Goods",
            ].includes(category) && (
              <button className="tab active">{category}</button>
            )}
          </div>
          <div className="view-controls">
            <button
              className={view === "grid" ? "chosen" : ""}
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={17} />
            </button>
            <button
              className={view === "list" ? "chosen" : ""}
              aria-label="List view"
              onClick={() => setView("list")}
            >
              <List size={19} />
            </button>
          </div>
        </div>
        {filters && (
          <div className="filters-panel">
            <label>
              Maximum price ($)
              <input
                type="number"
                min="0"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Any price"
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                setMax("");
                setCategory("All categories");
              }}
            >
              Clear filters
            </Button>
            <button
              aria-label="Close filters"
              onClick={() => setFilters(false)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="results-line">
          <span>
            {loading
              ? "Finding your next favorite…"
              : `${filtered.length} ${savedOnly ? "saved " : ""}finds near you`}
          </span>
          <label>
            Sort by:{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort listings"
            >
              <option value="newest">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
            <ChevronDown size={13} />
          </label>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <h3>We couldn’t load the listings</h3>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        ) : loading ? (
          <div className="listing-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Search size={32} />
            <h3>No finds just yet</h3>
            <p>Try another search or category, or add a listing of your own.</p>
            <Button asChild>
              <Link href="/" onNavigate={browseAll}>
                Browse all listings
              </Link>
            </Button>
          </div>
        ) : (
          <div
            className={"listing-grid " + (view === "list" ? "list-view" : "")}
          >
            {filtered.map((l, i) => (
              <article className="listing-card" key={l.id}>
                <div className="listing-image">
                  <Link
                    href={"/listing/?id=" + l.id}
                    aria-label={"View " + l.title}
                  >
                    <ListingImage
                      src={l.image_url}
                      title={l.title}
                      loading={i < 4 ? "eager" : "lazy"}
                    />
                  </Link>
                  {i === 0 && !search && (
                    <span className="listing-badge">A local favorite</span>
                  )}
                  <button
                    className={
                      "save-button " + (saved.includes(l.id) ? "is-saved" : "")
                    }
                    aria-label={
                      saved.includes(l.id)
                        ? "Unsave " + l.title
                        : "Save " + l.title
                    }
                    aria-pressed={saved.includes(l.id)}
                    onClick={() => toggle(l.id)}
                  >
                    <Bookmark
                      size={17}
                      fill={saved.includes(l.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <Link className="listing-info" href={"/listing/?id=" + l.id}>
                  <div className="listing-price">
                    {money(l.price)}
                    <span>{l.category}</span>
                  </div>
                  <h3>{l.title}</h3>
                  <p>{l.location || "Location not specified"}</p>
                </Link>
              </article>
            ))}
          </div>
        )}
        <footer className="browse-footer">
          <StoreMark /> A neighborhood full of possibilities.
        </footer>
      </main>
    </>
  );
}
function StoreMark() {
  return <span className="footer-mark">m.</span>;
}
