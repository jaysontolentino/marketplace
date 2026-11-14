"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  Search,
  Plus,
  ShoppingBag,
  Bookmark,
  ChevronDown,
  MapPin,
  Grid2X2,
  Car,
  Building2,
  Shirt,
  Tag,
  Laptop,
  Clapperboard,
  Baby,
  Gift,
  Flower2,
  Palette,
  Armchair,
  Hammer,
  House,
  Guitar,
  BriefcaseBusiness,
  PawPrint,
  Bike,
  Gamepad2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/marketplace";
import { Button } from "./ui/button";
const icons = [
  Grid2X2,
  Car,
  Building2,
  Shirt,
  Tag,
  Laptop,
  Clapperboard,
  Baby,
  Gift,
  Flower2,
  Palette,
  Armchair,
  Hammer,
  House,
  Guitar,
  BriefcaseBusiness,
  PawPrint,
  Bike,
  Gamepad2,
];
export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-icon">
        <Store size={23} />
      </span>
      <span>
        Marketplace<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function Header({
  search,
  onSearch,
}: {
  search?: string;
  onSearch?: (s: string) => void;
}) {
  return (
    <header className="topbar">
      <Logo />
      <div className="top-search">
        <Search size={19} />
        {onSearch ? (
          <input
            aria-label="Search Marketplace"
            placeholder="Search Marketplace"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        ) : (
          <Link href="/">Search Marketplace</Link>
        )}
        <span className="keyboard-hint">⌘ K</span>
      </div>
      <div className="header-right">
        <span className="local-label">
          <MapPin size={16} /> Palo Alto, CA
        </span>
        <Link href="/create/" className="header-sell">
          <Plus size={16} /> Sell something
        </Link>
        <span className="profile-avatar" title="Local marketplace">
          M
        </span>
      </div>
    </header>
  );
}
export function Sidebar({
  category = "All categories",
  onCategory,
  saved = false,
  onSaved,
  onBrowseAll,
  browseAllActive = true,
}: {
  category?: string;
  onCategory?: (s: string) => void;
  saved?: boolean;
  onSaved?: () => void;
  onBrowseAll?: () => void;
  browseAllActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <>
      <button
        className="mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label="Toggle categories"
      >
        {open ? <X size={20} /> : <Menu size={20} />} Categories
      </button>
      <aside className={"sidebar " + (open ? "sidebar-open" : "")}>
        <div className="sidebar-title">
          <h1>Marketplace</h1>
          <span className="tiny-badge">LOCAL</span>
        </div>
        <p className="sidebar-subtitle">Good finds. Close to home.</p>
        <nav className="main-nav">
          <Link
            href="/"
            className={
              !saved &&
              category === "All categories" &&
              browseAllActive &&
              path === "/"
                ? "nav-item active"
                : "nav-item"
            }
            onNavigate={() => {
              onBrowseAll?.();
              setOpen(false);
            }}
          >
            <span className="nav-icon">
              <ShoppingBag size={19} />
            </span>
            Browse all
          </Link>
          <button
            className={saved ? "nav-item active" : "nav-item"}
            onClick={onSaved}
            disabled={!onSaved}
          >
            <span className="nav-icon">
              <Bookmark size={18} />
            </span>
            Saved items
          </button>
        </nav>
        <Button asChild variant="secondary" className="create-button">
          <Link href="/create/">
            <Plus size={18} /> Create new listing
          </Link>
        </Button>
        <div className="sidebar-location">
          <span>Your location</span>
          <div>
            <MapPin size={15} />
            <strong>Palo Alto, California</strong>
          </div>
          <p>Discover great finds nearby</p>
        </div>
        <div className="category-title">
          Categories <ChevronDown size={15} />
        </div>
        <nav className="category-nav">
          {categories.map((name, i) => {
            const Icon = icons[i];
            return onCategory ? (
              <button
                key={name}
                className={
                  "category-item " +
                  (category === name && !saved ? "selected" : "")
                }
                onClick={() => {
                  onCategory(name);
                  setOpen(false);
                }}
              >
                <Icon size={18} />
                {name}
                {category === name && !saved && (
                  <span className="selected-dot" />
                )}
              </button>
            ) : (
              <Link
                key={name}
                href={"/?category=" + encodeURIComponent(name)}
                className="category-item"
              >
                <Icon size={18} />
                {name}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          A little less new. A lot more you.
          <br />
          <span>Marketplace © 2026</span>
        </div>
      </aside>
    </>
  );
}
