import { Suspense } from "react";
import { Browse } from "@/components/browse";
export default function Page() {
  return (
    <Suspense fallback={<p className="page-loading">Opening Marketplace…</p>}>
      <Browse />
    </Suspense>
  );
}
