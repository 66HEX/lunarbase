use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHasher};
use axum::{
    Extension,
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use diesel::prelude::*;
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::{
    AppState,
    models::{NewUser, UpdateUser, User, Role},
    schema::{users, roles},
    utils::auth_error::ApiResponse,
    utils::{LunarbaseError, Claims, ErrorResponse},
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListUsersQuery {
    #[schema(example = 10, minimum = 1, maximum = 100)]
    pub limit: Option<i64>,
    #[schema(example = 0, minimum = 0)]
    pub offset: Option<i64>,
    #[schema(example = "created_at:desc")]
    pub sort: Option<String>,
    #[schema(example = "email:like:@example.com")]
    pub filter: Option<String>,
    #[schema(example = "john")]
    pub search: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginatedUsersResponse {
    pub users: Vec<Value>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginationMeta {
    pub current_page: i64,
    pub page_size: i64,
    pub total_count: i64,
    pub total_pages: i64,
}

#[utoipa::path(
    get,
    path = "/users",
    tag = "Users",
    params(
        ("limit" = Option<i64>, Query, description = "Limit number of users (max 100)"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination"),
        ("sort" = Option<String>, Query, description = "Sort field (e.g., 'created_at', '-email')"),
        ("filter" = Option<String>, Query, description = "Filter expression (e.g., 'email:like:@example.com')"),
        ("search" = Option<String>, Query, description = "Search term for full-text search in email and username fields")
    ),
    responses(
        (status = 200, description = "Users retrieved successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_users(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<ApiResponse<PaginatedUsersResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let limit = query.limit.unwrap_or(10).min(100);
    let offset = query.offset.unwrap_or(0);

    let mut query_builder = users::table.into_boxed();

    if let Some(sort_str) = &query.sort {
        if sort_str.starts_with('-') {
            let field = &sort_str[1..];
            match field {
                "id" => query_builder = query_builder.order(users::id.desc()),
                "email" => query_builder = query_builder.order(users::email.desc()),
                "username" => query_builder = query_builder.order(users::username.desc()),
                "created_at" => query_builder = query_builder.order(users::created_at.desc()),
                "updated_at" => query_builder = query_builder.order(users::updated_at.desc()),
                _ => query_builder = query_builder.order(users::created_at.desc()),
            }
        } else {
            match sort_str.as_str() {
                "id" => query_builder = query_builder.order(users::id.asc()),
                "email" => query_builder = query_builder.order(users::email.asc()),
                "username" => query_builder = query_builder.order(users::username.asc()),
                "created_at" => query_builder = query_builder.order(users::created_at.asc()),
                "updated_at" => query_builder = query_builder.order(users::updated_at.asc()),
                _ => query_builder = query_builder.order(users::created_at.desc()),
            }
        }
    } else {
        query_builder = query_builder.order(users::created_at.desc());
    }

    if let Some(search_term) = &query.search {
        if !search_term.trim().is_empty() {
            let search_pattern = format!("%{}%", search_term.trim());
            query_builder = query_builder.filter(
                users::email
                    .like(search_pattern.clone())
                    .or(users::username.like(search_pattern)),
            );
        }
    }

    if let Some(filter_str) = &query.filter {
        if filter_str.contains("email:like:") {
            let pattern = filter_str.replace("email:like:", "");
            query_builder = query_builder.filter(users::email.like(format!("%{}%", pattern)));
        } else if filter_str.contains("username:like:") {
            let pattern = filter_str.replace("username:like:", "");
            query_builder = query_builder.filter(users::username.like(format!("%{}%", pattern)));
        } else if filter_str.contains("is_verified:eq:true") {
            query_builder = query_builder.filter(users::is_verified.eq(true));
        } else if filter_str.contains("is_verified:eq:false") {
            query_builder = query_builder.filter(users::is_verified.eq(false));
        }
    }

    let total_count: i64 = {
        let mut count_query = users::table.into_boxed();

        if let Some(search_term) = &query.search {
            if !search_term.trim().is_empty() {
                let search_pattern = format!("%{}%", search_term.trim());
                count_query = count_query.filter(
                    users::email
                        .like(search_pattern.clone())
                        .or(users::username.like(search_pattern)),
                );
            }
        }

        if let Some(filter_str) = &query.filter {
            if filter_str.contains("email:like:") {
                let pattern = filter_str.replace("email:like:", "");
                count_query = count_query.filter(users::email.like(format!("%{}%", pattern)));
            } else if filter_str.contains("username:like:") {
                let pattern = filter_str.replace("username:like:", "");
                count_query = count_query.filter(users::username.like(format!("%{}%", pattern)));
            } else if filter_str.contains("is_verified:eq:true") {
                count_query = count_query.filter(users::is_verified.eq(true));
            } else if filter_str.contains("is_verified:eq:false") {
                count_query = count_query.filter(users::is_verified.eq(false));
            }
        }

        count_query
            .count()
            .first(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?
    };

    let users_result: Vec<User> = query_builder
        .select(User::as_select())
        .limit(limit)
        .offset(offset)
        .load(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_responses: Vec<Value> = users_result
        .into_iter()
        .map(|user| serde_json::to_value(user.to_response()).unwrap())
        .collect();

    let current_page = (offset / limit) + 1;
    let total_pages = (total_count + limit - 1) / limit;

    let pagination_meta = PaginationMeta {
        current_page,
        page_size: limit,
        total_count,
        total_pages,
    };

    let response = PaginatedUsersResponse {
        users: user_responses,
        pagination: pagination_meta,
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/users/{user_id}",
    tag = "Users",
    params(
        ("user_id" = i32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User retrieved successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(user_id): axum::extract::Path<i32>,
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    Ok(Json(ApiResponse::success(
        serde_json::to_value(user.to_response()).unwrap(),
    )))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateUserRequest {
    #[schema(example = "user@example.com")]
    pub email: String,
    #[schema(example = "SecurePassword123!")]
    pub password: String,
    #[schema(example = "john_doe")]
    pub username: String,
    #[schema(example = "user")]
    pub role: String,
}

impl CreateUserRequest {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.email.is_empty() {
            errors.push("Email is required".to_string());
        } else if !self.email.contains('@') || self.email.len() > 255 {
            errors.push("Invalid email format".to_string());
        }

        if self.password.is_empty() {
            errors.push("Password is required".to_string());
        } else if self.password.len() < 8
            || !self.password.chars().any(|c| c.is_uppercase())
            || !self.password.chars().any(|c| c.is_lowercase())
            || !self.password.chars().any(|c| c.is_numeric())
            || !self.password.chars().any(|c| c.is_ascii_punctuation())
        {
            errors.push("Password must be at least 8 characters long and contain uppercase, lowercase, number and special character".to_string());
        }

        if self.username.is_empty() {
            errors.push("Username is required".to_string());
        } else if self.username.len() < 3
            || self.username.len() > 30
            || !self
                .username
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_')
        {
            errors.push("Username must be 3-30 characters long and contain only letters, numbers, and underscores".to_string());
        }

        if self.role.is_empty() {
            errors.push("Role is required".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[utoipa::path(
    post,
    path = "/users",
    tag = "Users",
    request_body = CreateUserRequest,
    responses(
        (status = 201, description = "User created successfully"),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 409, description = "User already exists", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_user(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    payload.validate().map_err(LunarbaseError::ValidationError)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let role_exists = roles::table
        .filter(roles::name.eq(&payload.role))
        .first::<Role>(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if role_exists.is_none() {
        return Err(LunarbaseError::ValidationError(vec![
            format!("Role '{}' does not exist", payload.role),
        ]));
    }

    let existing_email = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_email.is_some() {
        return Err(LunarbaseError::ValidationError(vec![
            "Email already registered".to_string(),
        ]));
    }

    let existing_username = users::table
        .filter(users::username.eq(&payload.username))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_username.is_some() {
        return Err(LunarbaseError::ValidationError(vec![
            "Username already taken".to_string(),
        ]));
    }

    let new_user = NewUser::new_with_role(
        payload.email,
        &payload.password,
        payload.username,
        payload.role,
        &app_state.password_pepper,
    )
    .map_err(|_| LunarbaseError::InternalError)?;

    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if app_state.email_service.is_configured() {
        if let Err(e) = app_state
            .email_service
            .send_verification_email(user.id, &user.email, &user.username)
            .await
        {
            eprintln!("Failed to send verification email to {}: {}", user.email, e);
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(
            serde_json::to_value(user.to_response()).unwrap(),
        )),
    ))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserRequest {
    #[schema(example = "user@example.com")]
    pub email: Option<String>,
    #[schema(example = "NewPassword123!")]
    pub password: Option<String>,
    #[schema(example = "john_doe_updated")]
    pub username: Option<String>,
    #[schema(example = true)]
    pub is_verified: Option<bool>,
    #[schema(example = true)]
    pub is_active: Option<bool>,
    #[schema(example = "admin")]
    pub role: Option<String>,
}

impl UpdateUserRequest {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if let Some(email) = &self.email {
            if email.is_empty() {
                errors.push("Email cannot be empty".to_string());
            } else if !email.contains('@') || email.len() > 255 {
                errors.push("Invalid email format".to_string());
            }
        }

        if let Some(password) = &self.password {
            if password.is_empty() {
                errors.push("Password cannot be empty".to_string());
            } else if password.len() < 8
                || !password.chars().any(|c| c.is_uppercase())
                || !password.chars().any(|c| c.is_lowercase())
                || !password.chars().any(|c| c.is_numeric())
                || !password.chars().any(|c| c.is_ascii_punctuation())
            {
                errors.push("Password must be at least 8 characters long and contain uppercase, lowercase, number and special character".to_string());
            }
        }

        if let Some(username) = &self.username {
            if username.is_empty() {
                errors.push("Username cannot be empty".to_string());
            } else if username.len() < 3
                || username.len() > 30
                || !username.chars().all(|c| c.is_alphanumeric() || c == '_')
            {
                errors.push("Username must be 3-30 characters long and contain only letters, numbers, and underscores".to_string());
            }
        }

        if let Some(role) = &self.role {
            if role.is_empty() {
                errors.push("Role cannot be empty".to_string());
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[utoipa::path(
    put,
    path = "/users/{user_id}",
    tag = "Users",
    params(
        ("user_id" = i32, Path, description = "User ID")
    ),
    request_body = UpdateUserRequest,
    responses(
        (status = 200, description = "User updated successfully"),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 409, description = "Email or username already exists", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_user(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(user_id): axum::extract::Path<i32>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    payload.validate().map_err(LunarbaseError::ValidationError)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if let Some(role) = &payload.role {
        let role_exists = roles::table
            .filter(roles::name.eq(role))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::DatabaseError)?;

        if role_exists.is_none() {
            return Err(LunarbaseError::ValidationError(vec![
                format!("Role '{}' does not exist", role),
            ]));
        }
    }

    let existing_user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    if let Some(new_email) = &payload.email {
        if new_email != &existing_user.email {
            let email_conflict = users::table
                .filter(users::email.eq(new_email))
                .filter(users::id.ne(user_id))
                .select(User::as_select())
                .first::<User>(&mut conn)
                .optional()
                .map_err(|_| LunarbaseError::DatabaseError)?;

            if email_conflict.is_some() {
                return Err(LunarbaseError::ValidationError(vec![
                    "Email already registered".to_string(),
                ]));
            }
        }
    }

    if let Some(new_username) = &payload.username {
        if new_username != &existing_user.username {
            let username_conflict = users::table
                .filter(users::username.eq(new_username))
                .filter(users::id.ne(user_id))
                .select(User::as_select())
                .first(&mut conn)
                .optional()
                .map_err(|_| LunarbaseError::DatabaseError)?;

            if username_conflict.is_some() {
                return Err(LunarbaseError::ValidationError(vec![
                    "Username already taken".to_string(),
                ]));
            }
        }
    }

    let mut update_data = UpdateUser {
        email: payload.email,
        password_hash: None,
        username: payload.username,
        is_verified: payload.is_verified,
        is_active: payload.is_active,
        role: payload.role,
        failed_login_attempts: None,
        locked_until: None,
        avatar_url: None,
        last_login_at: None,
    };

    if let Some(new_password) = &payload.password {
        let mut salt_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut salt_bytes);

        let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| LunarbaseError::InternalError)?;

        let peppered_password = format!("{}{}", new_password, &app_state.password_pepper);

        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 4, 2, None).unwrap(),
        );
        let password_hash = argon2
            .hash_password(peppered_password.as_bytes(), &salt)
            .map_err(|_| LunarbaseError::InternalError)?
            .to_string();

        update_data.password_hash = Some(password_hash);
    }

    diesel::update(users::table.find(user_id))
        .set(&update_data)
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let updated_user: User = users::table
        .select(User::as_select())
        .find(user_id)
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    Ok(Json(ApiResponse::success(
        serde_json::to_value(updated_user.to_response()).unwrap(),
    )))
}

#[utoipa::path(
    delete,
    path = "/users/{user_id}",
    tag = "Users",
    params(
        ("user_id" = i32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User deleted successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 409, description = "Cannot delete yourself", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_user(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(user_id): axum::extract::Path<i32>,
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let current_user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::ValidationError(vec!["Invalid token".to_string()]))?;

    if current_user_id == user_id {
        return Err(LunarbaseError::ValidationError(vec![
            "Cannot delete yourself".to_string(),
        ]));
    }

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let _existing_user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    let deleted_count = diesel::delete(users::table.find(user_id))
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if deleted_count == 0 {
        return Err(LunarbaseError::NotFound("User not found".to_string()));
    }

    Ok(Json(ApiResponse::success(serde_json::json!({
        "message": "User deleted successfully",
        "deleted_user_id": user_id
    }))))
}

#[utoipa::path(
    post,
    path = "/users/{user_id}/unlock",
    tag = "Users",
    params(
        ("user_id" = i32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User unlocked successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn unlock_user(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(user_id): axum::extract::Path<i32>,
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let existing_user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    if existing_user.locked_until.is_none() {
        return Err(LunarbaseError::BadRequest("User is not locked".to_string()));
    }

    let update_data = UpdateUser {
        email: None,
        password_hash: None,
        username: None,
        is_verified: None,
        is_active: None,
        role: None,
        failed_login_attempts: Some(0),
        locked_until: Some(None),
        avatar_url: None,
        last_login_at: None,
    };

    diesel::update(users::table.find(user_id))
        .set(&update_data)
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let updated_user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    Ok(Json(ApiResponse::success(
        serde_json::to_value(updated_user.to_response()).unwrap(),
    )))
}
