// API Response Types
export interface ApiResponse<T> {
	success: boolean;
	data: T;
	error?:
		| string
		| { message: string; code?: string; validation_errors?: string[] };
	timestamp: string;
}

// User Types
export interface User {
	id: number;
	email: string;
	username?: string;
	role: "admin" | "user" | "guest";
	is_verified: boolean;
	is_active: boolean;
	last_login_at?: string;
	locked_until?: string;
	avatar_url?: string;
	created_at: string;
	updated_at?: string;
}

export interface PaginationMeta {
	current_page: number;
	page_size: number;
	total_count: number;
	total_pages: number;
}

export interface PaginatedUsersResponse {
	users: User[];
	pagination: PaginationMeta;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	user: User;
	expires_in: number;
}

export interface RegisterRequest {
	email: string;
	password: string;
	username: string;
	role?: "admin" | "user";
}

// OAuth Types
export interface OAuthAuthorizationResponse {
	authorization_url: string;
	state: string;
}

export interface OAuthProvider {
	name: string;
	display_name: string;
	icon?: string;
}

export interface CreateUserRequest {
	email: string;
	password: string;
	username?: string;
	role: "admin" | "user" | "guest";
}

export interface UpdateUserRequest {
	email?: string;
	username?: string;
	role?: "admin" | "user" | "guest";
	is_active?: boolean;
}

export interface UsersListParams {
	page?: number;
	page_size?: number;
	limit?: number;
	offset?: number;
	search?: string;
	sort?: string;
	filter?: string;
}

// Collection Types
export interface FieldDefinition {
	name: string;
	field_type:
		| "text"
		| "number"
		| "boolean"
		| "date"
		| "email"
		| "url"
		| "json"
		| "file"
		| "relation";
	required: boolean;
	default_value?: unknown;
	validation?: {
		min_length?: number;
		max_length?: number;
		pattern?: string;
		enum_values?: string[];
	};
}

export interface CollectionSchema {
	fields: FieldDefinition[];
}

export interface Collection {
	id: number;
	name: string;
	display_name?: string;
	description?: string;
	schema: CollectionSchema;
	is_system: boolean;
	created_at: string;
	updated_at: string;
	permissions?: CollectionPermissions;
}

export interface CreateCollectionRequest {
	name: string;
	schema: CollectionSchema;
}

export interface UpdateCollectionRequest {
	name?: string;
	schema?: CollectionSchema;
}

// Record Types
export interface RecordData {
	[key: string]: unknown;
}

export interface ApiRecord {
	id: number;
	data: RecordData;
	created_at: string;
	updated_at: string;
	[key: string]: unknown;
}

export interface CreateRecordRequest {
	data: RecordData;
}

export interface UpdateRecordRequest {
	data: RecordData;
}

// Alias for backward compatibility
export type Record = ApiRecord;

// Record with collection name (for all records endpoint)
export interface RecordWithCollection extends ApiRecord {
	collection_name: string;
}

// Paginated Records Response
export interface PaginatedRecordsResponse {
	records: RecordWithCollection[];
	pagination: PaginationMeta;
}

// Query Types
export interface QueryOptions {
	sort?: string;
	filter?: string;
	search?: string;
	limit?: number;
	offset?: number;
}

// Permission Types
export interface BasePermissions {
	can_create: boolean;
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
	can_list: boolean;
}

export interface CollectionPermissions {
	role_permissions: {
		[roleName: string]: BasePermissions;
	};
	user_permissions: {
		[userId: string]: {
			can_create: boolean | null;
			can_read: boolean | null;
			can_update: boolean | null;
			can_delete: boolean | null;
			can_list: boolean | null;
		};
	};
}

export interface SetPermissionsRequest {
	can_create: boolean;
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
	can_list: boolean;
}

// Role Types
export interface Role {
	id: number;
	name: string;
	description?: string;
	priority: number;
	created_at: string;
	updated_at: string;
}

export interface CreateRoleRequest {
	name: string;
	description?: string;
	priority?: number;
}

export interface UpdateRoleRequest {
	name?: string;
	description?: string;
	priority?: number;
}

// Collection Permission Types
export interface CollectionPermission {
	id: number;
	role_id: number;
	collection_name: string;
	can_create: boolean;
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
	can_list: boolean;
	created_at: string;
	updated_at: string;
}

export interface SetCollectionPermissionRequest {
	role_name: string;
	collection_name: string;
	can_create: boolean;
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
	can_list: boolean;
}

// User Collection Permission Types
export interface UserCollectionPermission {
	id: number;
	user_id: number;
	collection_id: number;
	can_create: boolean | null;
	can_read: boolean | null;
	can_update: boolean | null;
	can_delete: boolean | null;
	can_list: boolean | null;
	created_at: string;
	updated_at: string;
}

export interface SetUserCollectionPermissionRequest {
	user_id: number;
	collection_name: string;
	can_create: boolean | null;
	can_read: boolean | null;
	can_update: boolean | null;
	can_delete: boolean | null;
	can_list: boolean | null;
}

// Permission Result Type
export interface PermissionResult {
	has_permission: boolean;
	reason?: string;
}

// Statistics Types
export interface CollectionStats {
	total_collections: number;
	total_records: number;
	collections_by_type: { [key: string]: number };
	records_per_collection: { [key: string]: number };
	field_types_distribution: { [key: string]: number };
	average_records_per_collection: number;
	largest_collection: string | null;
	smallest_collection: string | null;
}

// WebSocket Types
export interface WebSocketStats {
	total_connections: number;
	authenticated_connections: number;
	total_subscriptions: number;
	subscriptions_by_collection: { [key: string]: number };
}

export interface WebSocketConnection {
	connection_id: string;
	user_id?: number;
	connected_at: string;
	subscriptions: WebSocketSubscription[];
}

export interface WebSocketSubscription {
	subscription_id: string;
	collection_name: string;
	subscription_type: string;
	filters?: { [key: string]: unknown };
}

export interface WebSocketConnectionsResponse {
	connections: WebSocketConnection[];
	total_count: number;
}

export interface WebSocketActivity {
	timestamp: string;
	connection_id: string;
	user_id?: number;
	action: string;
	details?: string;
}

export interface WebSocketActivityResponse {
	activities: WebSocketActivity[];
	total_count: number;
}

export interface BroadcastMessageRequest {
	message: string;
	target_users?: number[];
	target_collections?: string[];
}

export interface BroadcastMessageResponse {
	sent_to_connections: number;
	message: string;
}

// Ownership Types
export interface OwnershipInfo {
	user_id?: number;
	created_by?: number;
	owner_id?: number;
	author_id?: number;
}

export interface OwnershipPermissions {
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
	is_owner: boolean;
}

export interface OwnershipCheckResponse {
	collection_name: string;
	record_id: number;
	user_id: number;
	is_owner: boolean;
	ownership_permissions: OwnershipPermissions;
}

export interface TransferOwnershipRequest {
	new_owner_id: number;
}

export interface OwnershipStatsResponse {
	collection_name: string;
	collection_id: number;
	total_records: number;
	owned_records: number;
	unowned_records: number;
	ownership_percentage: number;
	timestamp: string;
}

export interface OwnedRecordsResponse {
	collection_name: string;
	user_id: number;
	username?: string;
	total_owned: number;
	records: Record[];
}

// Error Types
export interface ApiError {
	error: string;
	validation_errors?: string[];
}

// Health Types
export interface HealthResponse {
	status: string;
	message: string;
	timestamp: string;
	version: string;
	uptime: number;
	database: DatabaseHealth;
	memory: MemoryInfo;
	system: SystemInfo;
}

export interface DatabaseHealth {
	status: string;
	connection_pool_size: number;
	active_connections: number;
	total_collections: number;
	total_records: number;
}

export interface MemoryInfo {
	used_mb: number;
	total_mb: number;
	usage_percentage: number;
}

export interface SystemInfo {
	cpu_usage: number;
	load_average: number;
	disk_usage_percentage: number;
}
