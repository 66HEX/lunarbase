// Main Store Configuration
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { RootStore } from "@/types/store.types";
// Import store slices
import { createAuthSlice } from "./auth.store";
import { createCollectionsSlice } from "./collections.store";
import { createPermissionsSlice } from "./permissions.store";
import { createRecordsSlice } from "./records.store";
import { createUISlice } from "./ui.store";
import { createUsersSlice } from "./users.store";

// Create the main store with all slices
export const useStore = create<RootStore>()(
	devtools(
		subscribeWithSelector(
			immer((...args) => ({
				auth: createAuthSlice(...args),
				collections: createCollectionsSlice(...args),
				records: createRecordsSlice(...args),
				users: createUsersSlice(...args),
				permissions: createPermissionsSlice(...args),
				ui: createUISlice(...args),
			})),
		),
		{
			name: "lunarbase-admin-store",
			enabled: process.env.NODE_ENV === "development",
		},
	),
);

// Selector hooks for better performance
export const useAuth = () => useStore((state) => state.auth);
export const useCollections = () => useStore((state) => state.collections);
export const useRecords = () => useStore((state) => state.records);
export const useUsers = () => useStore((state) => state.users);
export const usePermissions = () => useStore((state) => state.permissions);
export const useUI = () => useStore((state) => state.ui);

// Utility selectors
export const useIsLoading = () =>
	useStore(
		(state) =>
			state.auth.loading ||
			state.collections.loading ||
			state.records.loading ||
			state.users.loading ||
			state.permissions.loading,
	);

export const useHasError = () =>
	useStore(
		(state) =>
			state.auth.error ||
			state.collections.error ||
			state.records.error ||
			state.users.error ||
			state.permissions.error,
	);

// Export store for direct access (use sparingly)
export { useStore as store };

// Export types
export type { RootStore } from "@/types/store.types";
