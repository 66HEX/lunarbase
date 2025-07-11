// Store Types for Zustand Implementation

import type {
	Record as ApiRecord,
	Collection,
	CollectionPermission,
	CollectionStats,
	HealthResponse,
	Role,
	User,
	UserCollectionPermission,
	WebSocketStats,
} from "./api";

// Base store state interface
export interface BaseStoreState {
	loading: boolean;
	error: string | null;
}

// Auth Store Types
export interface AuthState extends BaseStoreState {
	user: User | null;
	isAuthenticated: boolean;
	accessToken: string | null;
	refreshToken: string | null;
}

export interface AuthActions {
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshTokens: () => Promise<boolean>;
	setUser: (user: User) => void;
	setTokens: (accessToken: string, refreshToken: string) => void;
	clearAuth: () => void;
}

export type AuthStore = AuthState & AuthActions;

// Collections Store Types
export interface CollectionsState extends BaseStoreState {
	collections: Collection[];
	selectedCollection: Collection | null;
	stats: CollectionStats | null;
	recordCounts: { [key: string]: number };
}

export interface CollectionsActions {
	fetchCollections: () => Promise<void>;
	fetchCollection: (name: string) => Promise<void>;
	createCollection: (data: any) => Promise<void>;
	updateCollection: (name: string, data: any) => Promise<void>;
	deleteCollection: (name: string) => Promise<void>;
	fetchStats: () => Promise<void>;
	fetchRecordCount: (collectionName: string) => Promise<void>;
	setSelectedCollection: (collection: Collection | null) => void;
}

export type CollectionsStore = CollectionsState & CollectionsActions;

// Records Store Types
export interface CollectionCache {
	records: ApiRecord[];
	currentPage: number;
	pageSize: number;
	totalCount: number;
	searchTerm: string;
	filters: { [key: string]: any };
	lastFetch: number;
	loading: boolean;
}

export interface RecordsState extends BaseStoreState {
	recordsByCollection: { [key: string]: ApiRecord[] };
	selectedRecord: ApiRecord | null;
	currentPage: number;
	pageSize: number;
	totalCount: number;
	searchTerm: string;
	filters: { [key: string]: any };
	collectionCaches: { [collectionName: string]: CollectionCache };
}

export interface RecordsActions {
	fetchRecords: (collectionName: string, options?: any) => Promise<void>;
	fetchRecord: (collectionName: string, id: number) => Promise<void>;
	createRecord: (collectionName: string, data: any) => Promise<void>;
	updateRecord: (
		collectionName: string,
		id: number,
		data: any,
	) => Promise<void>;
	deleteRecord: (collectionName: string, id: number) => Promise<void>;
	setSelectedRecord: (record: ApiRecord | null) => void;

	// Collection-specific actions
	setCollectionSearchTerm: (collectionName: string, term: string) => void;
	setCollectionCurrentPage: (collectionName: string, page: number) => void;
	setCollectionFilters: (
		collectionName: string,
		filters: { [key: string]: any },
	) => void;
	setCollectionPageSize: (collectionName: string, pageSize: number) => void;

	// Cache management
	getCollectionCache: (collectionName: string) => CollectionCache | null;
	clearCollectionCache: (collectionName: string) => void;
	clearAllCaches: () => void;

	// Legacy actions for backward compatibility
	setSearchTerm: (term: string) => void;
	setCurrentPage: (page: number) => void;
	setFilters: (filters: { [key: string]: any }) => void;
}

export type RecordsStore = RecordsState & RecordsActions;

// Users Store Types
export interface UsersState extends BaseStoreState {
	users: User[];
	selectedUser: User | null;
	currentPage: number;
	pageSize: number;
	totalCount: number;
}

export interface UsersActions {
	fetchUsers: (options?: any) => Promise<void>;
	fetchUser: (id: number) => Promise<void>;
	createUser: (data: any) => Promise<void>;
	updateUser: (id: number, data: any) => Promise<void>;
	deleteUser: (id: number) => Promise<void>;
	setSelectedUser: (user: User | null) => void;
	setCurrentPage: (page: number) => void;
}

export type UsersStore = UsersState & UsersActions;

// Permissions Store Types
export interface PermissionsState extends BaseStoreState {
	roles: Role[];
	rolePermissions: { [key: string]: CollectionPermission };
	userPermissions: { [key: number]: UserCollectionPermission };
	collectionPermissions: {
		[collectionName: string]: {
			[roleName: string]: CollectionPermission;
		};
	};
	userCollectionPermissions: {
		[collectionName: string]: {
			[userId: number]: UserCollectionPermission;
		};
	};
}

export interface PermissionsActions {
	// Role management
	fetchRoles: () => Promise<void>;
	createRole: (data: any) => Promise<void>;
	updateRole: (name: string, data: any) => Promise<void>;
	deleteRole: (name: string) => Promise<void>;

	// Role permissions
	fetchRolePermissions: (
		roleName: string,
		collectionName: string,
	) => Promise<void>;
	setRolePermissions: (data: any) => Promise<void>;

	// User permissions
	fetchUserPermissions: (
		userId: number,
		collectionName: string,
	) => Promise<void>;
	setUserPermissions: (data: any) => Promise<void>;

	// Utility methods
	checkUserPermission: (
		userId: number,
		collectionName: string,
		permission:
			| "can_create"
			| "can_read"
			| "can_update"
			| "can_delete"
			| "can_list",
	) => Promise<any>;
	getUserAccessibleCollections: (userId: number) => Promise<string[]>;

	// Bulk operations
	fetchAllRolePermissionsForCollection: (
		collectionName: string,
	) => Promise<void>;

	// Cache management
	clearPermissionsCache: () => void;
	getRolePermissionsFromCache: (
		roleName: string,
		collectionName: string,
	) => any;
	getUserPermissionsFromCache: (userId: number, collectionName: string) => any;
}

export type PermissionsStore = PermissionsState & PermissionsActions;

// UI Store Types
export interface UIState {
	sidebarOpen: boolean;
	theme: "light" | "dark";
	modals: {
		[key: string]: boolean;
	};
	sheets: {
		[key: string]: boolean;
	};
	notifications: Array<{
		id: string;
		type: "success" | "error" | "warning" | "info";
		title: string;
		message: string;
		timestamp: number;
		duration?: number;
	}>;
}

export interface UIActions {
	toggleSidebar: () => void;
	setSidebarOpen: (open: boolean) => void;
	setTheme: (theme: "light" | "dark") => void;
	openModal: (modalId: string) => void;
	closeModal: (modalId: string) => void;
	openSheet: (sheetId: string) => void;
	closeSheet: (sheetId: string) => void;
	addNotification: (
		notification: Omit<UIState["notifications"][0], "id" | "timestamp">,
	) => void;
	removeNotification: (id: string) => void;
	clearNotifications: () => void;
}

export type UIStore = UIState & UIActions;

// Dashboard Store Types
export interface DashboardState extends BaseStoreState {
	stats: {
		collections: CollectionStats | null;
		websocket: WebSocketStats | null;
		health: HealthResponse | null;
	};
}

export interface DashboardActions {
	fetchDashboardStats: () => Promise<void>;
	fetchCollectionStats: () => Promise<void>;
	fetchWebSocketStats: () => Promise<void>;
	fetchHealthStats: () => Promise<void>;
}

export type DashboardStore = DashboardState & DashboardActions;

// Root Store Type
export interface RootStore {
	auth: AuthStore;
	collections: CollectionsStore;
	records: RecordsStore;
	users: UsersStore;
	permissions: PermissionsStore;
	ui: UIStore;
}

// Utility types for store slices
export type StoreSlice<T> = (set: any, get: any) => T;

// API Query State
export interface ApiQueryState<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	lastFetch: number | null;
}

// Form State
export interface FormState<T> {
	data: T;
	errors: { [key: string]: string };
	touched: { [key: string]: boolean };
	submitting: boolean;
	dirty: boolean;
}
