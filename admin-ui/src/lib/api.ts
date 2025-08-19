import type {
	ApiResponse,
	BroadcastMessageRequest,
	BroadcastMessageResponse,
	Collection,
	CollectionPermission,
	CollectionStats,
	CreateCollectionRequest,
	CreateRecordRequest,
	CreateRoleRequest,
	CreateSystemSettingRequest,
	CreateUserRequest,
	ForgotPasswordRequest,
	HealthResponse,
	LoginRequest,
	LoginResponse,
	MetricsSummary,
	OAuthAuthorizationResponse,
	OAuthProvider,
	OwnedRecordsResponse,
	OwnershipCheckResponse,
	OwnershipStatsResponse,
	PaginatedRecordsResponse,
	PaginatedUsersResponse,
	PermissionResult,
	QueryOptions,
	Record,
	RecordWithCollection,
	RegisterRequest,
	ResetPasswordRequest,
	Role,
	SetCollectionPermissionRequest,
	SetUserCollectionPermissionRequest,
	SystemSetting,
	TransferOwnershipRequest,
	UpdateCollectionRequest,
	UpdateRecordRequest,
	UpdateRoleRequest,
	UpdateSystemSettingRequest,
	UpdateUserRequest,
	User,
	UserCollectionPermission,
	UsersListParams,
	WebSocketActivityResponse,
	WebSocketConnectionsResponse,
	WebSocketStats,
} from "@/types/api";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Auth token management is now handled via httpOnly cookies
// No client-side token management needed

// API Error handling
export class CustomApiError extends Error {
	public statusCode: number;
	public validationErrors?: string[];

	constructor(
		message: string,
		statusCode: number,
		validationErrors?: string[],
	) {
		super(message);
		this.name = "CustomApiError";
		this.statusCode = statusCode;
		this.validationErrors = validationErrors;
	}
}

// Base API function
async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {},
	isRetry: boolean = false,
): Promise<T> {
	// Don't set Content-Type for FormData - let browser set it with boundary
	const headers: { [key: string]: string } = {
		...(options.headers as { [key: string]: string }),
	};

	// Only set Content-Type if body is not FormData
	if (!(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	// Include credentials to send httpOnly cookies
	const url = `${API_BASE_URL}${endpoint}`;
	const config = {
		...options,
		headers,
		credentials: "include" as RequestCredentials, // This ensures cookies are sent with requests
	};

	const response = await fetch(url, config);

	if (!response.ok) {
		// Handle 401 Unauthorized - try to refresh token
		if (response.status === 401 && !isRetry && endpoint !== "/auth/refresh") {
			try {
				// Try to refresh the token using httpOnly cookies
				const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include", // Send httpOnly cookies
				});

				if (refreshResponse.ok) {
					// Retry the original request
					return apiRequest<T>(endpoint, options, true);
				}
			} catch {
				// Refresh failed, redirect to login
				window.location.href = "/admin/login";
			}
			// If refresh failed, redirect to login
			window.location.href = "/admin/login";
		}

		let errorData;
		try {
			errorData = await response.json();
		} catch {
			errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
		}

		// Handle different error response formats
		let errorMessage = "Request failed";

		if (errorData.error) {
			if (typeof errorData.error === "string") {
				errorMessage = errorData.error;
			} else if (errorData.error.message) {
				errorMessage = errorData.error.message;
			} else if (errorData.error.code) {
				errorMessage = errorData.error.code;
			}
		} else if (errorData.message) {
			errorMessage = errorData.message;
		}

		throw new CustomApiError(
			errorMessage,
			response.status,
			errorData.validation_errors,
		);
	}

	// Handle empty responses (like 204 No Content)
	const contentType = response.headers.get("content-type");
	if (!contentType || !contentType.includes("application/json")) {
		return undefined as T;
	}

	const text = await response.text();
	if (!text) {
		return undefined as T;
	}

	return JSON.parse(text);
}

// Auth API
export const authApi = {
	login: (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
		apiRequest<ApiResponse<LoginResponse>>("/auth/login", {
			method: "POST",
			body: JSON.stringify(credentials),
		}),

	register: async (data: RegisterRequest): Promise<User> => {
		const response = await apiRequest<ApiResponse<{ user: User }>>(
			"/auth/register",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
		return response.data.user as User;
	},

	me: async (): Promise<User> => {
		const response = await apiRequest<ApiResponse<User>>("/auth/me");
		return response.data as User;
	},

	// OAuth methods
	oauthAuthorize: (provider: string): Promise<OAuthAuthorizationResponse> =>
		apiRequest<OAuthAuthorizationResponse>(`/auth/oauth/${provider}`, {
			method: "GET",
		}),

	getOAuthProviders: (): OAuthProvider[] => [
		{ name: "google", display_name: "Google", icon: "🔍" },
		{ name: "github", display_name: "GitHub", icon: "🐙" },
	],

	refresh: async (): Promise<LoginResponse> => {
		const response = await apiRequest<ApiResponse<LoginResponse>>(
			"/auth/refresh",
			{
				method: "POST",
			},
		);
		return response.data;
	},

	logout: async (): Promise<void> => {
		await apiRequest<void>("/auth/logout", {
			method: "POST",
		});
	},

	forgotPassword: async (data: ForgotPasswordRequest): Promise<void> => {
		await apiRequest<void>("/auth/forgot-password", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
		await apiRequest<void>("/auth/reset-password", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},
};

// Backup API
export const backupApi = {
	// Create manual backup
	createManualBackup: async (): Promise<{
		message: string;
		backup_id: string;
		size_bytes: number;
	}> => {
		const response = await apiRequest<
			ApiResponse<{ message: string; backup_id: string; size_bytes: number }>
		>("/admin/backup", {
			method: "POST",
		});
		return response.data;
	},

	// Get backup health status
	getBackupHealth: async (): Promise<boolean> => {
		const response = await apiRequest<ApiResponse<boolean>>(
			"/admin/backup/health",
		);
		return response.data;
	},
};

// Collections API
export const collectionsApi = {
	list: (): Promise<ApiResponse<Collection[]>> =>
		apiRequest<ApiResponse<Collection[]>>("/collections"),

	get: (name: string): Promise<ApiResponse<Collection>> =>
		apiRequest<ApiResponse<Collection>>(`/collections/${name}`),

	create: async (data: CreateCollectionRequest): Promise<Collection> => {
		const response = await apiRequest<ApiResponse<Collection>>("/collections", {
			method: "POST",
			body: JSON.stringify(data),
		});
		return response.data;
	},

	update: async (
		name: string,
		data: UpdateCollectionRequest,
	): Promise<Collection> => {
		const response = await apiRequest<ApiResponse<Collection>>(
			`/collections/${name}`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		);
		return response.data;
	},

	delete: (name: string): Promise<void> =>
		apiRequest<void>(`/collections/${name}`, {
			method: "DELETE",
		}),

	getSchema: (name: string): Promise<unknown> =>
		apiRequest<unknown>(`/collections/${name}/schema`),

	getStats: async (): Promise<CollectionStats> => {
		const response =
			await apiRequest<ApiResponse<CollectionStats>>("/collections/stats");
		return response.data;
	},
};

// Records API
export const recordsApi = {
	list: async (
		collectionName: string,
		options?: QueryOptions,
	): Promise<PaginatedRecordsResponse> => {
		const params = new URLSearchParams();
		if (options?.sort) params.append("sort", options.sort);
		if (options?.filter) params.append("filter", options.filter);
		if (options?.search) params.append("search", options.search);
		if (options?.limit) params.append("limit", options.limit.toString());
		if (options?.offset) params.append("offset", options.offset.toString());

		const queryString = params.toString();
		const endpoint = `/collections/${collectionName}/records${queryString ? `?${queryString}` : ""}`;

		// Backend returns ApiResponse<Vec<RecordResponse>>, not PaginatedRecordsResponse
		const response = await apiRequest<ApiResponse<Record[]>>(endpoint);
		const records = response.data || [];

		// Get total count from collection stats
		const stats = await collectionsApi.getStats();
		const totalCount = stats.records_per_collection[collectionName] || 0;

		// Calculate pagination info
		const limit = options?.limit || 20;
		const offset = options?.offset || 0;
		const currentPage = Math.floor(offset / limit) + 1;
		const totalPages = Math.ceil(totalCount / limit);

		// Add collection_name to each record to match RecordWithCollection type
		const recordsWithCollection: RecordWithCollection[] = records.map(
			(record) => ({
				...record,
				collection_name: collectionName,
			}),
		);

		return {
			records: recordsWithCollection,
			pagination: {
				current_page: currentPage,
				page_size: limit,
				total_count: totalCount,
				total_pages: totalPages,
			},
		};
	},

	get: async (collectionName: string, id: number): Promise<Record> => {
		const response = await apiRequest<ApiResponse<Record>>(
			`/collections/${collectionName}/records/${id}`,
		);
		return response.data;
	},

	create: async (
		collectionName: string,
		data: CreateRecordRequest,
	): Promise<Record> => {
		const formData = new FormData();

		// Separate files from other data
		const recordData: { [key: string]: unknown } = {};
		const files: { [key: string]: File[] } = {};

		// Process each field in the data
		for (const [key, value] of Object.entries(data.data)) {
			if (
				Array.isArray(value) &&
				value.length > 0 &&
				value[0] instanceof File
			) {
				// This is a file field
				files[key] = value as File[];
			} else {
				// This is regular data
				recordData[key] = value;
			}
		}

		// Add JSON data
		const jsonData = JSON.stringify(recordData);
		formData.append("data", jsonData);

		// Add files
		for (const [fieldName, fileList] of Object.entries(files)) {
			for (const file of fileList) {
				// Backend expects file fields to be prefixed with "file_"
				const backendFieldName = `file_${fieldName}`;
				formData.append(backendFieldName, file);
			}
		}

		const response = await apiRequest<ApiResponse<Record>>(
			`/collections/${collectionName}/records`,
			{
				method: "POST",
				body: formData,
				headers: {}, // Let browser set Content-Type with boundary
			},
		);
		return response.data;
	},

	update: async (
		collectionName: string,
		id: number,
		data: UpdateRecordRequest,
	): Promise<Record> => {
		const formData = new FormData();

		// Separate files from other data
		const recordData: { [key: string]: unknown } = {};
		const files: { [key: string]: File[] } = {};

		// Process each field in the data
		for (const [key, value] of Object.entries(data.data)) {
			if (
				Array.isArray(value) &&
				value.length > 0 &&
				value[0] instanceof File
			) {
				// This is a file field
				files[key] = value as File[];
			} else {
				// This is regular data
				recordData[key] = value;
			}
		}

		// Add JSON data
		const jsonData = JSON.stringify(recordData);
		formData.append("data", jsonData);

		// Add files
		for (const [fieldName, fileList] of Object.entries(files)) {
			for (const file of fileList) {
				// Backend expects file fields to be prefixed with "file_"
				const backendFieldName = `file_${fieldName}`;
				formData.append(backendFieldName, file);
			}
		}

		const response = await apiRequest<ApiResponse<Record>>(
			`/collections/${collectionName}/records/${id}`,
			{
				method: "PUT",
				body: formData,
				headers: {}, // Let browser set Content-Type with boundary
			},
		);
		return response.data;
	},

	delete: (collectionName: string, id: number): Promise<void> =>
		apiRequest<void>(`/collections/${collectionName}/records/${id}`, {
			method: "DELETE",
		}),

	// List all records across all collections with pagination
	listAll: async (
		options?: QueryOptions,
	): Promise<PaginatedRecordsResponse> => {
		const queryParams = new URLSearchParams();

		if (options?.limit) queryParams.append("limit", options.limit.toString());
		if (options?.offset)
			queryParams.append("offset", options.offset.toString());
		if (options?.sort) queryParams.append("sort", options.sort);
		if (options?.filter) queryParams.append("filter", options.filter);
		if (options?.search) queryParams.append("search", options.search);

		const queryString = queryParams.toString();
		const endpoint = `/records${queryString ? `?${queryString}` : ""}`;

		// Backend returns ApiResponse<PaginatedRecordsResponse> for this endpoint
		const response =
			await apiRequest<ApiResponse<PaginatedRecordsResponse>>(endpoint);
		return response.data;
	},
};

// Roles API
export const rolesApi = {
	list: async (): Promise<Role[]> => {
		const response =
			await apiRequest<ApiResponse<Role[]>>("/permissions/roles");
		return response.data;
	},

	get: async (roleName: string): Promise<Role> => {
		const response = await apiRequest<ApiResponse<Role>>(
			`/permissions/roles/${roleName}`,
		);
		return response.data;
	},

	create: async (data: CreateRoleRequest): Promise<Role> => {
		const response = await apiRequest<ApiResponse<Role>>("/permissions/roles", {
			method: "POST",
			body: JSON.stringify(data),
		});
		return response.data;
	},

	update: async (roleName: string, data: UpdateRoleRequest): Promise<Role> => {
		const response = await apiRequest<ApiResponse<Role>>(
			`/permissions/roles/${roleName}`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		);
		return response.data;
	},

	delete: async (roleName: string): Promise<void> => {
		await apiRequest<void>(`/permissions/roles/${roleName}`, {
			method: "DELETE",
		});
	},
};

// Permissions API
export const permissionsApi = {
	// Collection permissions for roles
	setCollectionPermission: async (
		data: SetCollectionPermissionRequest,
	): Promise<void> => {
		const requestBody = {
			role_name: data.role_name,
			can_create: data.can_create,
			can_read: data.can_read,
			can_update: data.can_update,
			can_delete: data.can_delete,
			can_list: data.can_list,
		};

		await apiRequest<void>(`/permissions/collections/${data.collection_name}`, {
			method: "POST",
			body: JSON.stringify(requestBody),
		});
	},

	getCollectionPermissions: async (
		roleName: string,
		collectionName: string,
	): Promise<CollectionPermission> => {
		const response = await apiRequest<ApiResponse<CollectionPermission>>(
			`/permissions/roles/${roleName}/collections/${collectionName}`,
		);
		return response.data;
	},

	// User-specific collection permissions
	getUserCollectionPermissions: async (
		userId: number,
		collectionName: string,
	): Promise<UserCollectionPermission> => {
		const response = await apiRequest<ApiResponse<UserCollectionPermission>>(
			`/permissions/users/${userId}/collections/${collectionName}`,
		);
		return response.data;
	},

	setUserCollectionPermissions: async (
		data: SetUserCollectionPermissionRequest,
	): Promise<void> => {
		await apiRequest<void>(
			`/permissions/users/${data.user_id}/collections/${data.collection_name}`,
			{
				method: "POST",
				body: JSON.stringify({
					can_create: data.can_create,
					can_read: data.can_read,
					can_update: data.can_update,
					can_delete: data.can_delete,
					can_list: data.can_list,
				}),
			},
		);
	},

	// Check permissions
	checkCollectionPermission: async (
		userId: number,
		collectionName: string,
		permission:
			| "can_create"
			| "can_read"
			| "can_update"
			| "can_delete"
			| "can_list",
	): Promise<PermissionResult> => {
		const response = await apiRequest<ApiResponse<PermissionResult>>(
			`/permissions/check/users/${userId}/collections/${collectionName}/${permission}`,
		);
		return response.data;
	},

	// Get accessible collections for user
	getUserAccessibleCollections: async (userId: number): Promise<string[]> => {
		const response = await apiRequest<ApiResponse<string[]>>(
			`/permissions/users/${userId}/accessible-collections`,
		);
		return response.data;
	},

	// Get accessible collections for current user
	getMyAccessibleCollections: async (): Promise<Collection[]> => {
		const response = await apiRequest<
			ApiResponse<{ user_id: number; accessible_collections: Collection[] }>
		>("/permissions/users/me/collections");
		return response.data.accessible_collections;
	},
};

// WebSocket API
export const webSocketApi = {
	getStats: async (): Promise<WebSocketStats> => {
		const response = await apiRequest<ApiResponse<WebSocketStats>>("/ws/stats");
		return response.data;
	},
	getStatus: async (): Promise<{ status: string; message: string }> => {
		const response =
			await apiRequest<ApiResponse<{ status: string; message: string }>>(
				"/ws/status",
			);
		return response.data;
	},
	getConnections: async (): Promise<WebSocketConnectionsResponse> => {
		const response =
			await apiRequest<ApiResponse<WebSocketConnectionsResponse>>(
				"/ws/connections",
			);
		return response.data;
	},
	disconnectConnection: async (connectionId: string): Promise<void> => {
		await apiRequest<void>(`/ws/connections/${connectionId}`, {
			method: "DELETE",
		});
	},
	broadcastMessage: async (
		data: BroadcastMessageRequest,
	): Promise<BroadcastMessageResponse> => {
		const response = await apiRequest<ApiResponse<BroadcastMessageResponse>>(
			"/ws/broadcast",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
		return response.data;
	},
	getActivity: async (): Promise<WebSocketActivityResponse> => {
		const response =
			await apiRequest<ApiResponse<WebSocketActivityResponse>>("/ws/activity");
		return response.data;
	},
};

// Users API
export const usersApi = {
	list: async (params?: UsersListParams): Promise<PaginatedUsersResponse> => {
		const searchParams = new URLSearchParams();
		if (params?.limit) searchParams.append("limit", params.limit.toString());
		if (params?.offset) searchParams.append("offset", params.offset.toString());
		if (params?.sort) searchParams.append("sort", params.sort);
		if (params?.filter) searchParams.append("filter", params.filter);
		if (params?.search) searchParams.append("search", params.search);

		const url = `/users${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
		const response = await apiRequest<ApiResponse<PaginatedUsersResponse>>(url);
		return response.data as PaginatedUsersResponse;
	},

	get: async (id: number): Promise<User> => {
		const response = await apiRequest<ApiResponse<User>>(`/users/${id}`);
		return response.data as User;
	},

	create: async (data: CreateUserRequest): Promise<User> => {
		const response = await apiRequest<ApiResponse<User>>("/users", {
			method: "POST",
			body: JSON.stringify(data),
		});
		return response.data as User;
	},

	update: async (id: number, data: UpdateUserRequest): Promise<User> => {
		const response = await apiRequest<ApiResponse<User>>(`/users/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
		return response.data as User;
	},

	delete: async (id: number): Promise<void> => {
		await apiRequest<void>(`/users/${id}`, {
			method: "DELETE",
		});
	},

	unlock: async (id: number): Promise<User> => {
		const response = await apiRequest<ApiResponse<User>>(
			`/users/${id}/unlock`,
			{
				method: "POST",
			},
		);
		return response.data as User;
	},
};

// Health API
export const healthApi = {
	getHealth: (): Promise<HealthResponse> =>
		apiRequest<HealthResponse>("/health/admin"),
	getSimpleHealth: (): Promise<{ status: string; timestamp: string }> =>
		apiRequest<{ status: string; timestamp: string }>("/health/simple"),
};

// Metrics API
export const metricsApi = {
	getMetrics: async (): Promise<string> => {
		const response = await fetch(`${API_BASE_URL}/metrics`, {
			credentials: "include",
		});
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.text();
	},
	getSummary: async (): Promise<MetricsSummary> => {
		const response = await apiRequest<MetricsSummary>("/metrics/summary");
		return response;
	},
};

// Configuration API
export const configurationApi = {
	// Get all system settings
	getAllSettings: async (): Promise<SystemSetting[]> => {
		const response = await apiRequest<
			ApiResponse<{ settings: SystemSetting[] }>
		>("/admin/configuration");
		return response.data.settings;
	},

	// Get settings by category
	getSettingsByCategory: async (
		category: "database" | "auth" | "api",
	): Promise<SystemSetting[]> => {
		const response = await apiRequest<
			ApiResponse<{ settings: SystemSetting[] }>
		>(`/admin/configuration/${category}`);
		return response.data.settings;
	},

	// Get a specific setting
	getSetting: async (
		category: "database" | "auth" | "api",
		settingKey: string,
	): Promise<SystemSetting> => {
		const response = await apiRequest<ApiResponse<SystemSetting>>(
			`/admin/configuration/${category}/${settingKey}`,
		);
		return response.data;
	},

	// Create a new setting
	createSetting: async (
		data: CreateSystemSettingRequest,
	): Promise<SystemSetting> => {
		const response = await apiRequest<ApiResponse<SystemSetting>>(
			"/admin/configuration",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
		return response.data;
	},

	// Update a setting
	updateSetting: async (
		category: "database" | "auth" | "api",
		settingKey: string,
		data: UpdateSystemSettingRequest,
	): Promise<SystemSetting> => {
		const response = await apiRequest<ApiResponse<SystemSetting>>(
			`/admin/configuration/${category}/${settingKey}`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		);
		return response.data;
	},

	// Delete a setting
	deleteSetting: async (
		category: "database" | "auth" | "api",
		settingKey: string,
	): Promise<void> => {
		await apiRequest<void>(`/admin/configuration/${category}/${settingKey}`, {
			method: "DELETE",
		});
	},

	// Reset setting to default value
	resetSetting: async (
		category: "database" | "auth" | "api",
		settingKey: string,
	): Promise<SystemSetting> => {
		const response = await apiRequest<ApiResponse<SystemSetting>>(
			`/admin/configuration/${category}/${settingKey}/reset`,
			{
				method: "POST",
			},
		);
		return response.data;
	},
};

// Ownership API
export const ownershipApi = {
	// Transfer ownership of a record
	transferOwnership: async (
		collectionName: string,
		recordId: number,
		data: TransferOwnershipRequest,
	): Promise<void> => {
		await apiRequest<void>(
			`/ownership/collections/${collectionName}/records/${recordId}/transfer`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
	},

	// Get records owned by current user
	getMyOwnedRecords: async (
		collectionName: string,
		limit?: number,
		offset?: number,
	): Promise<OwnedRecordsResponse> => {
		const params = new URLSearchParams();
		if (limit) params.append("limit", limit.toString());
		if (offset) params.append("offset", offset.toString());

		const queryString = params.toString();
		const endpoint = `/ownership/collections/${collectionName}/my-records${
			queryString ? `?${queryString}` : ""
		}`;

		const response =
			await apiRequest<ApiResponse<OwnedRecordsResponse>>(endpoint);
		return response.data;
	},

	// Get records owned by a specific user (admin only)
	getUserOwnedRecords: async (
		collectionName: string,
		userId: number,
		limit?: number,
		offset?: number,
	): Promise<OwnedRecordsResponse> => {
		const params = new URLSearchParams();
		if (limit) params.append("limit", limit.toString());
		if (offset) params.append("offset", offset.toString());

		const queryString = params.toString();
		const endpoint = `/ownership/collections/${collectionName}/users/${userId}/records${
			queryString ? `?${queryString}` : ""
		}`;

		const response =
			await apiRequest<ApiResponse<OwnedRecordsResponse>>(endpoint);
		return response.data;
	},

	// Check ownership of a specific record
	checkRecordOwnership: async (
		collectionName: string,
		recordId: number,
	): Promise<OwnershipCheckResponse> => {
		const response = await apiRequest<ApiResponse<OwnershipCheckResponse>>(
			`/ownership/collections/${collectionName}/records/${recordId}/check`,
		);
		return response.data;
	},

	// Get ownership statistics for a collection
	getOwnershipStats: async (
		collectionName: string,
	): Promise<OwnershipStatsResponse> => {
		const response = await apiRequest<ApiResponse<OwnershipStatsResponse>>(
			`/ownership/collections/${collectionName}/stats`,
		);
		return response.data;
	},
};

// Export individual functions for backward compatibility
export const createManualBackup = backupApi.createManualBackup;
export const getBackupHealth = backupApi.getBackupHealth;
