import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Listing = {
  status?: "available" | "sold";
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  seller_email: string;
  image_url: string | null;
  location: string | null;
  created_at: string;
  updated_at?: string;
};

export type NewListing = {
  title: string;
  description: string;
  price: number;
  category: string;
  seller_email: string;
  location: string;
};

export const categories = [
  "All categories",
  "Vehicles",
  "Property Rentals",
  "Apparel",
  "Classifieds",
  "Electronics",
  "Entertainment",
  "Family",
  "Free Stuff",
  "Garden & Outdoor",
  "Hobbies",
  "Home Goods",
  "Home Improvement",
  "Home Sales",
  "Musical Instruments",
  "Office Supplies",
  "Pet Supplies",
  "Sporting Goods",
  "Toys & Games",
];

let client: SupabaseClient | undefined;
function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart or rebuild the app.",
    );
  }
  client = createClient(url, key);
  return client;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
function validEmail(value: string) {
  return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getListings(): Promise<Listing[]> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load listings: " + error.message);
  return data ?? [];
}

export async function getListing(id: string): Promise<Listing | null> {
  if (!uuid.test(id)) return null;
  const { data, error } = await getSupabase()
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load this listing: " + error.message);
  return data;
}

export async function createListing(
  values: NewListing,
  file: File,
): Promise<Listing> {
  const listing = {
    title: values.title.trim(),
    description: values.description.trim(),
    price: values.price,
    category: values.category,
    seller_email: values.seller_email.trim(),
    location: values.location.trim(),
  };
  if (
    !listing.title ||
    listing.title.length > 255 ||
    !listing.description ||
    listing.description.length > 5000 ||
    !listing.location ||
    listing.location.length > 255
  ) {
    throw new Error(
      "Complete the title, description, and location within the allowed lengths.",
    );
  }
  if (
    !Number.isFinite(listing.price) ||
    listing.price < 0 ||
    listing.price > 99999999.99 ||
    Math.abs(listing.price * 100 - Math.round(listing.price * 100)) > 0.00001
  ) {
    throw new Error(
      "Enter a price from $0 to $99,999,999.99 with up to two decimal places.",
    );
  }
  if (!categories.slice(1).includes(listing.category))
    throw new Error("Choose a listing category.");
  if (!validEmail(listing.seller_email))
    throw new Error("Enter a valid seller email address.");
  if (!imageTypes[file.type] || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG, or WebP photo up to 5 MB.");
  }
  const supabase = getSupabase();
  const path = crypto.randomUUID() + "." + imageTypes[file.type];
  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError)
    throw new Error("Could not upload your photo: " + uploadError.message);
  const { data: photo } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...listing, image_url: photo.publicUrl })
    .select()
    .single();
  if (error)
    throw new Error(
      "Your photo uploaded, but the listing could not be saved: " +
        error.message,
    );
  if (!data)
    throw new Error(
      "Supabase did not return the published listing. Check the listings SELECT policy.",
    );
  return data;
}

export async function sendMessage(
  listing: Listing,
  buyerEmail: string,
  text: string,
) {
  if (!uuid.test(listing.id))
    throw new Error(
      "This listing is unavailable. Refresh the page and try again.",
    );
  const buyer_email = buyerEmail.trim();
  const message = text.trim();
  if (!validEmail(buyer_email))
    throw new Error("Enter a valid email address so the seller can reply.");
  if (!message || message.length > 5000)
    throw new Error("Write a message between 1 and 5,000 characters.");
  const { error } = await getSupabase().from("messages").insert({
    listing_id: listing.id,
    buyer_email,
    seller_email: listing.seller_email,
    message,
  });
  if (error) throw new Error("Could not send your message: " + error.message);
}

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
