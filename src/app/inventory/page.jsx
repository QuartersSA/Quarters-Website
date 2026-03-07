"use client";

import React from "react";

export default function InventoryAliasPage() {
  React.useEffect(() => {
    window.location.href = "/employee/inventory";
  }, []);

  return null;
}
