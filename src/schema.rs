// @generated automatically by Diesel CLI.

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
