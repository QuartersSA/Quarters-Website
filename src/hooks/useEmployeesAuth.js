import { useState, useEffect } from "react";
import { ADMIN_TOKEN_KEY } from "@/utils/apiAuth";

const ADMIN_LOGIN_PATH = "/admin/login";

export function useEmployeesAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("adminAuth");
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!auth || !token) {
      window.location.href = ADMIN_LOGIN_PATH;
      return;
    }

    // Guard: only admins with can_manage_employees can access /admin/employees
    try {
      const raw = localStorage.getItem("adminUser");
      const u = raw ? JSON.parse(raw) : null;
      const allowed = !!u?.can_manage_employees;
      if (!allowed) {
        window.location.href = "/admin";
        return;
      }
    } catch {
      window.location.href = "/admin";
      return;
    }

    setIsAuthenticated(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminMode");
    localStorage.removeItem("workspaceUser");
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = ADMIN_LOGIN_PATH;
  };

  return { isAuthenticated, handleLogout };
}
