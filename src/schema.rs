// @generated automatically by Diesel CLI.

diesel::table! {
    blacklisted_tokens (id) {
        id -> Integer,
        jti -> Text,
        user_id -> Integer,
        token_type -> Text,
        expires_at -> Timestamp,
        blacklisted_at -> Timestamp,
        reason -> Nullable<Text>,
    }
}

diesel::table! {
    collection_permissions (id) {
        id -> Integer,
        collection_id -> Integer,
        role_id -> Integer,
        can_create -> Bool,
        can_read -> Bool,
        can_update -> Bool,
        can_delete -> Bool,
        can_list -> Bool,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    collection_records (id) {
        id -> Integer,
        collection_id -> Integer,
        data_json -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    collections (id) {
        id -> Integer,
        name -> Text,
        display_name -> Nullable<Text>,
        description -> Nullable<Text>,
        schema_json -> Text,
        is_system -> Bool,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    record_permissions (id) {
        id -> Integer,
        record_id -> Integer,
        collection_id -> Integer,
        user_id -> Integer,
        can_read -> Bool,
        can_update -> Bool,
        can_delete -> Bool,
        created_at -> Timestamp,
    }
}

diesel::table! {
    roles (id) {
        id -> Integer,
        name -> Text,
        description -> Nullable<Text>,
        priority -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    user_collection_permissions (id) {
        id -> Integer,
        user_id -> Integer,
        collection_id -> Integer,
        can_create -> Nullable<Bool>,
        can_read -> Nullable<Bool>,
        can_update -> Nullable<Bool>,
        can_delete -> Nullable<Bool>,
        can_list -> Nullable<Bool>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    users (id) {
        id -> Integer,
        email -> Text,
        password_hash -> Text,
        username -> Text,
        is_verified -> Bool,
        is_active -> Bool,
        role -> Text,
        failed_login_attempts -> Integer,
        locked_until -> Nullable<Timestamp>,
        last_login_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        avatar_url -> Nullable<Text>,
    }
}

diesel::joinable!(blacklisted_tokens -> users (user_id));
diesel::joinable!(collection_permissions -> collections (collection_id));
diesel::joinable!(collection_permissions -> roles (role_id));
diesel::joinable!(collection_records -> collections (collection_id));
diesel::joinable!(record_permissions -> collections (collection_id));
diesel::joinable!(record_permissions -> users (user_id));
diesel::joinable!(user_collection_permissions -> collections (collection_id));
diesel::joinable!(user_collection_permissions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    blacklisted_tokens,
    collection_permissions,
    collection_records,
    collections,
    record_permissions,
    roles,
    user_collection_permissions,
    users,
);
