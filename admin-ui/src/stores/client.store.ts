import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ToastPosition } from "@/components/ui/toast";

interface ClientState {
	ui: {
		sidebar: {
			isOpen: boolean;
		};
		theme: "light" | "dark" | "system";
		modals: {
			createCollection: boolean;
			editCollection: boolean;
			deleteCollection: boolean;
			createRecord: boolean;
			editRecord: boolean;
			deleteRecord: boolean;
			userProfile: boolean;
			permissions: boolean;
			broadcast: boolean;
			deleteUser: boolean;
		};
		sheets: {
			recordDetails: boolean;
			collectionSettings: boolean;
			collectionDetails: boolean;
			userSettings: boolean;
			editRecord: boolean;
			createUser: boolean;
			userDetails: boolean;
			editUser: boolean;
			createRecord: boolean;
		};
		notifications: Array<{
			id: string;
			title: string;
			description?: string;
			variant?: "default" | "success" | "warning" | "destructive";
			position?: ToastPosition;
			duration?: number;
		}>;
	};

	selected: {
		collectionName: string | null;
		recordId: number | null;
		userId: number | null;
	};

	forms: {
		recordForm: {
			isOpen: boolean;
			mode: "create" | "edit" | null;
			collectionName: string | null;
			recordId: number | null;
			isDirty: boolean;
		};
		collectionForm: {
			isOpen: boolean;
			mode: "create" | "edit" | null;
			collectionName: string | null;
			isDirty: boolean;
		};
	};
}

interface ClientActions {
	toggleSidebar: () => void;
	setSidebarOpen: (isOpen: boolean) => void;
	setTheme: (theme: "light" | "dark" | "system") => void;

	openModal: (modal: keyof ClientState["ui"]["modals"]) => void;
	closeModal: (modal: keyof ClientState["ui"]["modals"]) => void;
	closeAllModals: () => void;

	openSheet: (sheet: keyof ClientState["ui"]["sheets"]) => void;
	closeSheet: (sheet: keyof ClientState["ui"]["sheets"]) => void;
	closeAllSheets: () => void;

	addNotification: (
		notification: Omit<ClientState["ui"]["notifications"][0], "id">,
	) => string;
	removeNotification: (id: string) => void;
	clearNotifications: () => void;

	setSelectedCollection: (collectionName: string | null) => void;
	setSelectedRecord: (recordId: number | null) => void;
	setSelectedUser: (userId: number | null) => void;
	clearSelections: () => void;

	openRecordForm: (
		mode: "create" | "edit",
		collectionName: string,
		recordId?: number,
	) => void;
	closeRecordForm: () => void;
	setRecordFormDirty: (isDirty: boolean) => void;

	openCollectionForm: (
		mode: "create" | "edit",
		collectionName?: string,
	) => void;
	closeCollectionForm: () => void;
	setCollectionFormDirty: (isDirty: boolean) => void;
}

type ClientStore = ClientState & ClientActions;

const initialState: ClientState = {
	ui: {
		sidebar: {
			isOpen: true,
		},
		theme: "system",
		modals: {
			createCollection: false,
			editCollection: false,
			deleteCollection: false,
			createRecord: false,
			editRecord: false,
			deleteRecord: false,
			userProfile: false,
			permissions: false,
			broadcast: false,
			deleteUser: false,
		},
		sheets: {
			recordDetails: false,
			collectionSettings: false,
			collectionDetails: false,
			userSettings: false,
			editRecord: false,
			createUser: false,
			userDetails: false,
			editUser: false,
			createRecord: false,
		},
		notifications: [],
	},
	selected: {
		collectionName: null,
		recordId: null,
		userId: null,
	},
	forms: {
		recordForm: {
			isOpen: false,
			mode: null,
			collectionName: null,
			recordId: null,
			isDirty: false,
		},
		collectionForm: {
			isOpen: false,
			mode: null,
			collectionName: null,
			isDirty: false,
		},
	},
};

export const useClientStore = create<ClientStore>()(
	devtools(
		immer((set) => ({
			...initialState,

			toggleSidebar: () =>
				set((state: ClientState) => {
					state.ui.sidebar.isOpen = !state.ui.sidebar.isOpen;
				}),

			setSidebarOpen: (isOpen: boolean) =>
				set((state: ClientState) => {
					state.ui.sidebar.isOpen = isOpen;
				}),

			setTheme: (theme: "light" | "dark" | "system") =>
				set((state: ClientState) => {
					state.ui.theme = theme;
				}),

			openModal: (modal: keyof ClientState["ui"]["modals"]) =>
				set((state: ClientState) => {
					state.ui.modals[modal] = true;
				}),

			closeModal: (modal: keyof ClientState["ui"]["modals"]) =>
				set((state: ClientState) => {
					state.ui.modals[modal] = false;
				}),

			closeAllModals: () =>
				set((state: ClientState) => {
					Object.keys(state.ui.modals).forEach((key) => {
						state.ui.modals[key as keyof typeof state.ui.modals] = false;
					});
				}),

			openSheet: (sheet: keyof ClientState["ui"]["sheets"]) =>
				set((state: ClientState) => {
					state.ui.sheets[sheet] = true;
				}),

			closeSheet: (sheet: keyof ClientState["ui"]["sheets"]) =>
				set((state: ClientState) => {
					state.ui.sheets[sheet] = false;
				}),

			closeAllSheets: () =>
				set((state: ClientState) => {
					Object.keys(state.ui.sheets).forEach((key) => {
						state.ui.sheets[key as keyof typeof state.ui.sheets] = false;
					});
				}),

			addNotification: (
				notification: Omit<ClientState["ui"]["notifications"][0], "id">,
			) => {
				const id = Math.random().toString(36).substring(2, 11);
				set((state: ClientState) => {
					state.ui.notifications.push({ ...notification, id });
				});
				return id;
			},

			removeNotification: (id: string) =>
				set((state: ClientState) => {
					state.ui.notifications = state.ui.notifications.filter(
						(n) => n.id !== id,
					);
				}),

			clearNotifications: () =>
				set((state: ClientState) => {
					state.ui.notifications = [];
				}),

			setSelectedCollection: (collectionName: string | null) =>
				set((state: ClientState) => {
					state.selected.collectionName = collectionName;
				}),

			setSelectedRecord: (recordId: number | null) =>
				set((state: ClientState) => {
					state.selected.recordId = recordId;
				}),

			setSelectedUser: (userId: number | null) =>
				set((state: ClientState) => {
					state.selected.userId = userId;
				}),

			clearSelections: () =>
				set((state: ClientState) => {
					state.selected.collectionName = null;
					state.selected.recordId = null;
					state.selected.userId = null;
				}),

			openRecordForm: (
				mode: "create" | "edit",
				collectionName: string,
				recordId?: number,
			) =>
				set((state: ClientState) => {
					state.forms.recordForm.isOpen = true;
					state.forms.recordForm.mode = mode;
					state.forms.recordForm.collectionName = collectionName;
					state.forms.recordForm.recordId = recordId || null;
					state.forms.recordForm.isDirty = false;
				}),

			closeRecordForm: () =>
				set((state: ClientState) => {
					state.forms.recordForm.isOpen = false;
					state.forms.recordForm.mode = null;
					state.forms.recordForm.collectionName = null;
					state.forms.recordForm.recordId = null;
					state.forms.recordForm.isDirty = false;
				}),

			setRecordFormDirty: (isDirty: boolean) =>
				set((state: ClientState) => {
					state.forms.recordForm.isDirty = isDirty;
				}),

			openCollectionForm: (mode: "create" | "edit", collectionName?: string) =>
				set((state: ClientState) => {
					state.forms.collectionForm.isOpen = true;
					state.forms.collectionForm.mode = mode;
					state.forms.collectionForm.collectionName = collectionName || null;
					state.forms.collectionForm.isDirty = false;
				}),

			closeCollectionForm: () =>
				set((state: ClientState) => {
					state.forms.collectionForm.isOpen = false;
					state.forms.collectionForm.mode = null;
					state.forms.collectionForm.collectionName = null;
					state.forms.collectionForm.isDirty = false;
				}),

			setCollectionFormDirty: (isDirty: boolean) =>
				set((state: ClientState) => {
					state.forms.collectionForm.isDirty = isDirty;
				}),
		})),
		{
			name: "client-store",
		},
	),
);

export const useUI = () => useClientStore((state) => state.ui);
export const useSelected = () => useClientStore((state) => state.selected);
export const useForms = () => useClientStore((state) => state.forms);

export const useUIActions = () => {
	const toggleSidebar = useClientStore((state) => state.toggleSidebar);
	const setSidebarOpen = useClientStore((state) => state.setSidebarOpen);
	const setTheme = useClientStore((state) => state.setTheme);
	const openModal = useClientStore((state) => state.openModal);
	const closeModal = useClientStore((state) => state.closeModal);
	const closeAllModals = useClientStore((state) => state.closeAllModals);
	const openSheet = useClientStore((state) => state.openSheet);
	const closeSheet = useClientStore((state) => state.closeSheet);
	const closeAllSheets = useClientStore((state) => state.closeAllSheets);
	const addNotification = useClientStore((state) => state.addNotification);
	const removeNotification = useClientStore(
		(state) => state.removeNotification,
	);
	const clearNotifications = useClientStore(
		(state) => state.clearNotifications,
	);

	return {
		toggleSidebar,
		setSidebarOpen,
		setTheme,
		openModal,
		closeModal,
		closeAllModals,
		openSheet,
		closeSheet,
		closeAllSheets,
		addNotification,
		removeNotification,
		clearNotifications,
	};
};

export const useSelectionActions = () => {
	const setSelectedCollection = useClientStore(
		(state) => state.setSelectedCollection,
	);
	const setSelectedRecord = useClientStore((state) => state.setSelectedRecord);
	const setSelectedUser = useClientStore((state) => state.setSelectedUser);
	const clearSelections = useClientStore((state) => state.clearSelections);

	return {
		setSelectedCollection,
		setSelectedRecord,
		setSelectedUser,
		clearSelections,
	};
};

export const useFormActions = () => {
	const openRecordForm = useClientStore((state) => state.openRecordForm);
	const closeRecordForm = useClientStore((state) => state.closeRecordForm);
	const setRecordFormDirty = useClientStore(
		(state) => state.setRecordFormDirty,
	);
	const openCollectionForm = useClientStore(
		(state) => state.openCollectionForm,
	);
	const closeCollectionForm = useClientStore(
		(state) => state.closeCollectionForm,
	);
	const setCollectionFormDirty = useClientStore(
		(state) => state.setCollectionFormDirty,
	);

	return {
		openRecordForm,
		closeRecordForm,
		setRecordFormDirty,
		openCollectionForm,
		closeCollectionForm,
		setCollectionFormDirty,
	};
};
