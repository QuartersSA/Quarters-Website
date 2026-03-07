import { useEffect, useMemo, useState } from "react";

function readInitialUser() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("workspaceUser");
    if (stored) return JSON.parse(stored);

    const adminAuth = localStorage.getItem("adminAuth");
    const adminUser = localStorage.getItem("adminUser");
    if (adminAuth && adminUser) return JSON.parse(adminUser);
  } catch {
    // ignore
  }
  return null;
}

export default function useWorkspaceUser() {
  const [ready, setReady] = useState(() => typeof window !== "undefined");
  const [user, setUser] = useState(readInitialUser);

  useEffect(() => {
    if (ready && user) return;
    const u = readInitialUser();
    setUser(u);
    setReady(true);
  }, []);

  const employeeId = useMemo(() => {
    const id = user?.id;
    if (typeof id === "number") return id;
    const maybe = Number(id);
    if (Number.isFinite(maybe)) return maybe;
    return null;
  }, [user]);

  return {
    ready,
    user,
    employeeId,
    isAuthenticated: !!employeeId,
  };
}
