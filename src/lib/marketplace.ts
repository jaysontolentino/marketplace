import { createClient } from "@supabase/supabase-js";
export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_email: string;
  image_url: string;
  location: string;
  created_at: string;
  updated_at?: string;
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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
const photo = (id: string) =>
  "https://images.unsplash.com/" + id + "?auto=format&fit=crop&w=900&q=85";
const samples: [string, number, string, string, string][] = [
  [
    "Mid-century accent chair",
    125,
    "Home Goods",
    "photo-1598300042247-d088f8ab3a91",
    "A beautiful warm-toned accent chair with solid wood legs. A comfortable reading spot and a timeless addition to your home. In excellent condition.",
  ],
  [
    "Fujifilm X100V digital camera",
    950,
    "Electronics",
    "photo-1516035069371-29a1b244cc32",
    "A much-loved camera, ready for its next adventure. Fully working and carefully maintained. Includes the original charger and strap.",
  ],
  [
    "City cruiser bicycle",
    180,
    "Sporting Goods",
    "photo-1485965120184-e220f721d03e",
    "An easygoing ride for sunny days and neighborhood errands. Recently serviced, with smooth gears and good tires.",
  ],
  [
    "Monstera in ceramic planter",
    35,
    "Garden & Outdoor",
    "photo-1501004318641-b39e6451bec6",
    "Healthy, happy monstera looking for a new home. Comes with its ceramic pot. Loves a bright room with indirect light.",
  ],
  [
    "Sony wireless headphones",
    85,
    "Electronics",
    "photo-1546435770-a3e426bf472b",
    "Comfortable wireless headphones with rich sound. Lightly used, with charging cable included.",
  ],
  [
    "Oak bedside table",
    65,
    "Home Goods",
    "photo-1499933374294-4584851497cc",
    "Simple oak table with a lovely natural grain. Great beside a bed or sofa. Pickup available this weekend.",
  ],
  [
    "Classic white sneakers · Size 9",
    45,
    "Apparel",
    "photo-1549298916-b41d501d3772",
    "Clean everyday sneakers, only worn a handful of times. Selling because they are a little small for me.",
  ],
  [
    "Acoustic guitar + soft case",
    120,
    "Musical Instruments",
    "photo-1510915361894-db8b60106cb1",
    "Warm-sounding acoustic guitar in good condition. Perfect for a beginner or for playing around the house. Case included.",
  ],
  [
    "Everyday canvas backpack",
    30,
    "Apparel",
    "photo-1553062407-98eeb64c6a62",
    "A sturdy backpack for work, school, or a weekend away. All zippers work perfectly.",
  ],
  [
    "Vintage record player",
    90,
    "Electronics",
    "photo-1461360370896-922624d12aa1",
    "Give your favorite albums another spin. A charming record player with a warm sound and classic looks.",
  ],
  [
    "Linen lounge sofa",
    350,
    "Home Goods",
    "photo-1555041469-a586c61ea9bc",
    "Comfortable three-seat sofa in a neutral color. From a smoke-free home. Bring a friend to help with pickup.",
  ],
  [
    "Weekend camping tent",
    75,
    "Sporting Goods",
    "photo-1504851149312-7a075b496cc7",
    "Get outside with this easy-to-set-up tent. Used for two trips. Packs down neatly in the included carry bag.",
  ],
];
export const demoListings: Listing[] = samples.map((v, i) => ({
  id: "demo-" + (i + 1),
  title: v[0],
  price: v[1],
  category: v[2],
  image_url: photo(v[3]),
  description: v[4],
  seller_email: ["alex", "sam", "jordan", "taylor"][i % 4] + "@example.com",
  location: [
    "Palo Alto, CA",
    "Menlo Park, CA",
    "Mountain View, CA",
    "Stanford, CA",
  ][i % 4],
  created_at: new Date(Date.UTC(2026, 10, 14, 2) - i * 3600000).toISOString(),
}));
export async function getListings(): Promise<Listing[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return [
    ...JSON.parse(localStorage.getItem("marketplace-listings") || "[]"),
    ...demoListings,
  ];
}
export async function getListing(id: string): Promise<Listing | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  return (await getListings()).find((l) => l.id === id) ?? null;
}
export async function createListing(
  values: Omit<Listing, "id" | "created_at" | "image_url">,
  file: File,
): Promise<Listing> {
  if (supabase) {
    const path =
      crypto.randomUUID() + "." + file.name.split(".").pop()?.toLowerCase();
    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicData } = supabase.storage
      .from("listing-images")
      .getPublicUrl(path);
    const { data, error } = await supabase
      .from("listings")
      .insert({ ...values, image_url: publicData.publicUrl })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const image_url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const listing = {
    ...values,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    image_url,
  };
  const existing = JSON.parse(
    localStorage.getItem("marketplace-listings") || "[]",
  );
  localStorage.setItem(
    "marketplace-listings",
    JSON.stringify([listing, ...existing]),
  );
  return listing;
}
export async function sendMessage(
  listing: Listing,
  buyer_email: string,
  message: string,
) {
  const values = {
    listing_id: listing.id,
    buyer_email,
    seller_email: listing.seller_email,
    message,
  };
  if (supabase) {
    const { error } = await supabase.from("messages").insert(values);
    if (error) throw new Error(error.message);
    return;
  }
  const old = JSON.parse(localStorage.getItem("marketplace-messages") || "[]");
  localStorage.setItem(
    "marketplace-messages",
    JSON.stringify([
      ...old,
      {
        ...values,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      },
    ]),
  );
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
