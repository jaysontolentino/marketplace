import { Suspense } from "react";
import { ListingDetail } from "@/components/listing-detail";
export default function Page() {
  return (
    <Suspense fallback={<p className="page-loading">Loading your find…</p>}>
      <ListingDetail />
    </Suspense>
  );
}
