import { adminDb, apiError, HttpError, uuid } from "@/lib/payments";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("listing_id") || "";
    if (!uuid.test(id)) throw new HttpError(400, "Invalid listing.");
    const db = adminDb();
    const { data: listing, error } = await db
      .from("listings")
      .select("seller_email,status,price")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!listing) throw new HttpError(404, "Listing not found.");
    const { data: seller, error: sellerError } = await db
      .from("stripe_sellers")
      .select("charges_enabled,payouts_enabled,details_submitted")
      .eq("email", listing.seller_email.trim().toLowerCase())
      .maybeSingle();
    if (sellerError) throw sellerError;
    return Response.json(
      {
        sold: listing.status === "sold",
        purchasable:
          listing.status === "available" &&
          listing.price >= 0.5 &&
          listing.price <= 999999.99 &&
          !!seller?.charges_enabled &&
          !!seller?.payouts_enabled &&
          !!seller?.details_submitted,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
