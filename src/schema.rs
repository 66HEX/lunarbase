// @generated automatically by Diesel CLI.

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
    records_admin_test_1752183449960978000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752183514267816000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752183669122494000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752249975980708000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752250965436906000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752251801865108000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752251933003253000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_admin_test_1752251985443820000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752183449953311000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752183514263354000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752183669116234000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752249975972588000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752250965427953000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752251801857403000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752251932996598000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_get_test_1752251985438107000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752183449987619000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752183514286669000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752183669148034000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752249976009400000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752250424703109000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752250965467974000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752251801892332000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752251933028515000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_list_records_1752251985467171000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_products (id) {
        id -> Integer,
        name -> Text,
        price -> Float,
        category -> Nullable<Text>,
        in_stock -> Nullable<Bool>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752183449967083000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752183504644810000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752183514272121000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752183669127997000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752249975987104000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752250965443986000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752251801870528000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752251933010088000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_record_test_1752251985448524000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752183449978777000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752183514279496000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752183669138621000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752249975998600000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752250965456106000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752251801880861000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752251933018750000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_schema_test_1752251985456719000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752183449973973000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752183514275981000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752183669133717000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752249975993188000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752250965450205000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752251801876187000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752251933014812000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    records_validation_test_1752251985452950000 (id) {
        id -> Integer,
        title -> Text,
        content -> Nullable<Text>,
        published -> Nullable<Bool>,
        views -> Nullable<Float>,
        email -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
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
    }
}

diesel::joinable!(collection_permissions -> collections (collection_id));
diesel::joinable!(collection_permissions -> roles (role_id));
diesel::joinable!(collection_records -> collections (collection_id));
diesel::joinable!(record_permissions -> collections (collection_id));
diesel::joinable!(record_permissions -> users (user_id));
diesel::joinable!(user_collection_permissions -> collections (collection_id));
diesel::joinable!(user_collection_permissions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    collection_permissions,
    collection_records,
    collections,
    record_permissions,
    records_admin_test_1752183449960978000,
    records_admin_test_1752183514267816000,
    records_admin_test_1752183669122494000,
    records_admin_test_1752249975980708000,
    records_admin_test_1752250965436906000,
    records_admin_test_1752251801865108000,
    records_admin_test_1752251933003253000,
    records_admin_test_1752251985443820000,
    records_get_test_1752183449953311000,
    records_get_test_1752183514263354000,
    records_get_test_1752183669116234000,
    records_get_test_1752249975972588000,
    records_get_test_1752250965427953000,
    records_get_test_1752251801857403000,
    records_get_test_1752251932996598000,
    records_get_test_1752251985438107000,
    records_list_records_1752183449987619000,
    records_list_records_1752183514286669000,
    records_list_records_1752183669148034000,
    records_list_records_1752249976009400000,
    records_list_records_1752250424703109000,
    records_list_records_1752250965467974000,
    records_list_records_1752251801892332000,
    records_list_records_1752251933028515000,
    records_list_records_1752251985467171000,
    records_products,
    records_record_test_1752183449967083000,
    records_record_test_1752183504644810000,
    records_record_test_1752183514272121000,
    records_record_test_1752183669127997000,
    records_record_test_1752249975987104000,
    records_record_test_1752250965443986000,
    records_record_test_1752251801870528000,
    records_record_test_1752251933010088000,
    records_record_test_1752251985448524000,
    records_schema_test_1752183449978777000,
    records_schema_test_1752183514279496000,
    records_schema_test_1752183669138621000,
    records_schema_test_1752249975998600000,
    records_schema_test_1752250965456106000,
    records_schema_test_1752251801880861000,
    records_schema_test_1752251933018750000,
    records_schema_test_1752251985456719000,
    records_validation_test_1752183449973973000,
    records_validation_test_1752183514275981000,
    records_validation_test_1752183669133717000,
    records_validation_test_1752249975993188000,
    records_validation_test_1752250965450205000,
    records_validation_test_1752251801876187000,
    records_validation_test_1752251933014812000,
    records_validation_test_1752251985452950000,
    roles,
    user_collection_permissions,
    users,
);
