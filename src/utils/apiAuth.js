export const ADMIN_TOKEN_KEY = "adminToken";
export const EMPLOYEE_INVENTORY_TOKEN_KEY = "employeeInventoryToken";
export const SHIFT_CLOSE_TOKEN_KEY = "shiftCloseToken";

function safeGetItem(key) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getAdminToken() {
  return safeGetItem(ADMIN_TOKEN_KEY);
}

export function getEmployeeInventoryToken() {
  return safeGetItem(EMPLOYEE_INVENTORY_TOKEN_KEY);
}

export function getShiftCloseToken() {
  return safeGetItem(SHIFT_CLOSE_TOKEN_KEY);
}

export function withBearer(token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return {
    ...init,
    headers,
  };
}

export function adminFetch(url, init = {}) {
  const token = getAdminToken();
  return fetch(url, withBearer(token, init));
}

export function employeeInventoryFetch(url, init = {}) {
  const token = getEmployeeInventoryToken();
  return fetch(url, withBearer(token, init));
}

export function shiftCloseFetch(url, init = {}) {
  const token = getShiftCloseToken();
  return fetch(url, withBearer(token, init));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("adminAuth");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminMode");
    localStorage.removeItem("workspaceUser");
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function clearEmployeeSessions() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("employee"); // legacy key
    localStorage.removeItem("employeeInventorySession");
    localStorage.removeItem(EMPLOYEE_INVENTORY_TOKEN_KEY);

    localStorage.removeItem("shiftCloseUser");
    localStorage.removeItem(SHIFT_CLOSE_TOKEN_KEY);
  } catch {
    // ignore
  }
}
