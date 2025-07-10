// @generated automatically by Diesel CLI.

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
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    collections,
    users,
);
