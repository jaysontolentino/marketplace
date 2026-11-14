"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export function ListingImage({
  src,
  title,
  loading,
}: {
  src: string | null;
  title: string;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed)
    return (
      <div className="listing-placeholder">
        <ImageOff size={28} />
        <span>No photo available</span>
      </div>
    );
  return (
    <img
      src={src}
      alt={title}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
