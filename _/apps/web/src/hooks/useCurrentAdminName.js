import { useState, useEffect } from "react";

export function useCurrentAdminName() {
  const [currentAdminName, setCurrentAdminName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("adminUser");
      const u = raw ? JSON.parse(raw) : null;
      const name = u?.name ? String(u.name) : "";
      const username = u?.username ? String(u.username) : "";
      setCurrentAdminName(username || name || "");
    } catch (e) {
      console.error(e);
      setCurrentAdminName("");
    }
  }, []);

  return currentAdminName;
}
