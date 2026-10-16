// This file makes /problem/active route to the workspace (the [id] page).
// The [id] segment can be any string; we use "active" as the canonical
// URL for the currently-in-progress problem (stored in Zustand).
export { default } from "../[id]/page";
