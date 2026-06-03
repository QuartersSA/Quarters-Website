// Re-export from the shared sidebar package so existing imports
// (`@/components/Admin/CommandPalette`) keep working after the
// section-agnostic shell extraction.
export { CommandPalette, default } from "@/components/Sidebar/CommandPalette";
