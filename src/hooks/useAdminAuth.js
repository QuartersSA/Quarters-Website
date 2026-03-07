import { useState, useEffect } from "react";
import { ADMIN_TOKEN_KEY } from "@/utils/apiAuth";

const ADMIN_LOGIN_PATH = "/admin/login";

export function useAdminAuth(options = {}) {
  const {
    requiredPermission,
    requiredAnyPermissions, // NEW: allow any-of permissions
    redirect = true,
  } = options;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState(null);
  const [missingPermission, setMissingPermission] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setChecked(false);
    setReason(null);
    setMissingPermission(null);

    try {
      const auth = localStorage.getItem("adminAuth");
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);

      if (!auth || !token) {
        setIsAuthenticated(false);
        setReason("not_logged_in");
        setChecked(true);
        if (redirect) {
          window.location.href = ADMIN_LOGIN_PATH;
        }
        return;
      }

      const checkPermission = (u, perm) => {
        const requiredValueRaw = u?.[perm];

        // Backward compat: HR used to be gated by can_manage_employees
        const effectiveRequiredValue =
          perm === "can_access_hr" &&
          (requiredValueRaw === undefined || requiredValueRaw === null)
            ? u?.can_manage_employees
            : requiredValueRaw;

        return !!effectiveRequiredValue;
      };

      const effectiveAny = Array.isArray(requiredAnyPermissions)
        ? requiredAnyPermissions.filter(Boolean)
        : [];

      if (effectiveAny.length > 0 || requiredPermission) {
        try {
          const raw = localStorage.getItem("adminUser");
          const u = raw ? JSON.parse(raw) : null;

          if (effectiveAny.length > 0) {
            const allowed = effectiveAny.some((perm) =>
              checkPermission(u, perm),
            );
            if (!allowed) {
              setIsAuthenticated(false);
              setReason("missing_permission");
              setMissingPermission(effectiveAny.join("|"));
              setChecked(true);
              if (redirect) {
                window.location.href = "/admin";
              }
              return;
            }
          } else if (requiredPermission) {
            const allowed = checkPermission(u, requiredPermission);
            if (!allowed) {
              setIsAuthenticated(false);
              setReason("missing_permission");
              setMissingPermission(requiredPermission);
              setChecked(true);
              if (redirect) {
                window.location.href = "/admin";
              }
              return;
            }
          }
        } catch {
          setIsAuthenticated(false);
          setReason("error");
          setChecked(true);
          if (redirect) {
            window.location.href = "/admin";
          }
          return;
        }
      }

      setIsAuthenticated(true);
      setReason(null);
      setMissingPermission(null);
      setChecked(true);
    } catch (e) {
      console.error(e);
      setIsAuthenticated(false);
      setReason("error");
      setChecked(true);
      if (redirect) {
        window.location.href = ADMIN_LOGIN_PATH;
      }
    }
  }, [requiredPermission, requiredAnyPermissions, redirect]);

  const logout = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("adminAuth");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminMode");
    localStorage.removeItem("workspaceUser");
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = ADMIN_LOGIN_PATH;
  };

  return { isAuthenticated, logout, checked, reason, missingPermission };
}
