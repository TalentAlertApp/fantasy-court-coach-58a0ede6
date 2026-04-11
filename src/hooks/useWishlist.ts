import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "nba_wishlist";

function loadWishlist(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState<number[]>(loadWishlist);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistIds));
  }, [wishlistIds]);

  const addToWishlist = useCallback((id: number) => {
    setWishlistIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeFromWishlist = useCallback((id: number) => {
    setWishlistIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const isInWishlist = useCallback(
    (id: number) => wishlistIds.includes(id),
    [wishlistIds]
  );

  const toggleWishlist = useCallback((id: number) => {
    setWishlistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return { wishlistIds, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist };
}
