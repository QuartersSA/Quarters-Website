import { useEffect, useState } from "react";

export default function useMediaQuery(query, defaultValue = false) {
  // The first client render must match SSR. Reading matchMedia in the state
  // initializer caused mobile-only controls to appear before hydration.
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
