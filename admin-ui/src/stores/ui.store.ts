// UI Store Slice
import type { StateCreator } from "zustand";
import type { RootStore, UIStore } from "@/types/store.types";

export const createUISlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	UIStore
> = (set, get) => ({
	// Initial state
	sidebarOpen: true,
	theme: "light",
	modals: {
		createCollection: false,
		editCollection: false,
		deleteCollection: false,
		createRecord: false,
		editRecord: false,
		deleteRecord: false,
		createUser: false,
		editUser: false,
		deleteUser: false,
		createRole: false,
		editRole: false,
		deleteRole: false,
		permissions: false,
	},
	sheets: {
		collectionDetails: false,
		recordDetails: false,
		userDetails: false,
		roleDetails: false,
		permissions: false,
	},
	notifications: [],

	// Actions
	toggleSidebar: () => {
		set((state) => {
			state.ui.sidebarOpen = !state.ui.sidebarOpen;
		});
	},

	setSidebarOpen: (open: boolean) => {
		set((state) => {
			state.ui.sidebarOpen = open;
		});
	},

	setTheme: (theme: "light" | "dark") => {
		set((state) => {
			state.ui.theme = theme;
		});
	},

	openModal: (modalName: keyof UIStore["modals"]) => {
		set((state) => {
			state.ui.modals[modalName] = true;
		});
	},

	closeModal: (modalName: keyof UIStore["modals"]) => {
		set((state) => {
			state.ui.modals[modalName] = false;
		});
	},

	closeAllModals: () => {
		set((state) => {
			Object.keys(state.ui.modals).forEach((key) => {
				state.ui.modals[key as keyof UIStore["modals"]] = false;
			});
		});
	},

	openSheet: (sheetName: keyof UIStore["sheets"]) => {
		set((state) => {
			state.ui.sheets[sheetName] = true;
		});
	},

	closeSheet: (sheetName: keyof UIStore["sheets"]) => {
		set((state) => {
			state.ui.sheets[sheetName] = false;
		});
	},

	closeAllSheets: () => {
		set((state) => {
			Object.keys(state.ui.sheets).forEach((key) => {
				state.ui.sheets[key as keyof UIStore["sheets"]] = false;
			});
		});
	},

	addNotification: (notification: {
		id?: string;
		type: "success" | "error" | "warning" | "info";
		title: string;
		message: string;
		duration?: number;
	}) => {
		const id = notification.id || Date.now().toString();
		const duration = notification.duration || 5000;

		set((state) => {
			state.ui.notifications.push({
				...notification,
				id,
				duration,
				timestamp: Date.now(),
			});
		});

		// Auto-remove notification after duration
		if (duration > 0) {
			setTimeout(() => {
				get().ui.removeNotification(id);
			}, duration);
		}
	},

	removeNotification: (id: string) => {
		set((state) => {
			state.ui.notifications = state.ui.notifications.filter(
				(n) => n.id !== id,
			);
		});
	},

	clearNotifications: () => {
		set((state) => {
			state.ui.notifications = [];
		});
	},
});
