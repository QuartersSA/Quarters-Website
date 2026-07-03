export const ADMIN_TOKEN_KEY = "adminToken";
export const EMPLOYEE_INVENTORY_TOKEN_KEY = "employeeInventoryToken";
export const SHIFT_CLOSE_TOKEN_KEY = "shiftCloseToken";
export const EMPLOYEE_WASTE_TOKEN_KEY = "employeeWasteToken";
export const PURCHASE_INVOICE_TOKEN_KEY = "purchaseInvoiceToken";

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

export function getEmployeeWasteToken() {
  return safeGetItem(EMPLOYEE_WASTE_TOKEN_KEY);
}

export function getPurchaseInvoiceToken() {
  return safeGetItem(PURCHASE_INVOICE_TOKEN_KEY);
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

export function workspaceFetch(url, init = {}) {
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

export function employeeWasteFetch(url, init = {}) {
  const token = getEmployeeWasteToken();
  return fetch(url, withBearer(token, init));
}

export function purchaseInvoiceFetch(url, init = {}) {
  const token = getPurchaseInvoiceToken();
  return fetch(url, withBearer(token, init));
}

/**
 * `fetch` that attaches whichever session token the user currently has,
 * preferring stronger sessions (admin) first. Used by features whose API
 * accepts any authenticated employee — primarily `/api/uploads/*`, which
 * is consumed by admin pages, workspace pages, and field-staff pages.
 *
 * Returns the response unmodified if no token is present so the server
 * still has a chance to reject with 401.
 */
export function authedFetch(url, init = {}) {
  const token =
    getAdminToken() ||
    getEmployeeInventoryToken() ||
    getShiftCloseToken() ||
    getEmployeeWasteToken() ||
    getPurchaseInvoiceToken() ||
    null;
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

    localStorage.removeItem("employeeWasteSession");
    localStorage.removeItem(EMPLOYEE_WASTE_TOKEN_KEY);

    localStorage.removeItem("purchaseInvoiceSession");
    localStorage.removeItem(PURCHASE_INVOICE_TOKEN_KEY);
  } catch {
    // ignore
  }
}
