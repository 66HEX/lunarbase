# Plan implementacji uploadu plików na S3 w Lunarbase

Po dokładnej analizie backendu, przygotowałem szczegółowy plan implementacji funkcjonalności uploadu plików na S3. Backend już posiada typ pola `File` w schemacie kolekcji, ale obecnie traktuje go tylko jako ścieżkę tekstową.

## Obecna struktura backendu

### Kluczowe komponenty:
- **Handler**: `src/handlers/collections.rs` - endpoint `create_record` (linia 202)
- **Service**: `src/services/collection_service.rs` - metoda `create_record_with_events` (linia 1164)
- **Modele**: `src/models/collection.rs` - `FieldType::File` już istnieje (linia 120)
- **Walidacja**: `validate_field_value` obsługuje typ `File` jako string (linia 1867)

## Plan implementacji

### 1. Dodanie zależności AWS S3

**Plik**: `Cargo.toml`
```toml
# Dodać do [dependencies]
aws-sdk-s3 = "1.0"
aws-config = "1.0"
aws-types = "1.0"
tokio-util = { version = "0.7", features = ["io"] }
multipart = "0.18"
bytes = "1.5"
base64 = "0.22"
```

### 2. Konfiguracja S3

**Plik**: `src/config/mod.rs`
```rust
// Dodać do struktury Config
pub aws_access_key_id: Option<String>,
pub aws_secret_access_key: Option<String>,
pub aws_region: Option<String>,
pub s3_bucket_name: Option<String>,
pub s3_endpoint_url: Option<String>, // dla LocalStack/MinIO
```

**Plik**: `env.example`
```env
# ===========================================
# S3 CONFIGURATION
# ===========================================
# AWS S3 Configuration for file uploads
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=lunarbase-files

# Optional: Custom S3 endpoint (for LocalStack, MinIO, etc.)
S3_ENDPOINT_URL=http://localhost:4566
```

### 3. Serwis S3

**Nowy plik**: `src/services/s3_service.rs`
```rust
use aws_sdk_s3::{Client, Error as S3Error, config::Region};
use aws_config::{BehaviorVersion, SdkConfig};
use bytes::Bytes;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone)]
pub struct S3Service {
    client: Client,
    bucket_name: String,
}

impl S3Service {
    pub async fn new(config: &crate::config::Config) -> Result<Self, Box<dyn std::error::Error>> {
        let mut aws_config_builder = aws_config::defaults(BehaviorVersion::latest());
        
        // Set region
        if let Some(region) = &config.aws_region {
            aws_config_builder = aws_config_builder.region(Region::new(region.clone()));
        }
        
        // Set custom endpoint if provided (for LocalStack/MinIO)
        if let Some(endpoint_url) = &config.s3_endpoint_url {
            aws_config_builder = aws_config_builder.endpoint_url(endpoint_url);
        }
        
        let aws_config = aws_config_builder.load().await;
        let s3_client = Client::new(&aws_config);
        
        let bucket_name = config.s3_bucket_name
            .as_ref()
            .ok_or("S3_BUCKET_NAME not configured")?
            .clone();
        
        Ok(Self {
            client: s3_client,
            bucket_name,
        })
    }
    
    pub async fn upload_file(
        &self,
        key: &str,
        content: Bytes,
        content_type: Option<String>,
    ) -> Result<String, S3Error> {
        let mut put_object = self.client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(content.into());
        
        if let Some(ct) = content_type {
            put_object = put_object.content_type(ct);
        }
        
        put_object.send().await?;
        
        // Return the public URL
        Ok(format!("https://{}.s3.amazonaws.com/{}", self.bucket_name, key))
    }
    
    pub async fn delete_file(&self, key: &str) -> Result<(), S3Error> {
        self.client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await?;
        
        Ok(())
    }
    
    pub async fn upload_multiple_files(
        &self,
        files: HashMap<String, (Bytes, Option<String>)>,
    ) -> Result<HashMap<String, String>, (HashMap<String, String>, S3Error)> {
        let mut uploaded_urls = HashMap::new();
        let mut uploaded_keys = Vec::new();
        
        for (field_name, (content, content_type)) in files {
            let key = format!("{}/{}", Uuid::new_v4(), field_name);
            
            match self.upload_file(&key, content, content_type).await {
                Ok(url) => {
                    uploaded_urls.insert(field_name, url);
                    uploaded_keys.push(key);
                }
                Err(e) => {
                    // Cleanup already uploaded files
                    for uploaded_key in uploaded_keys {
                        let _ = self.delete_file(&uploaded_key).await;
                    }
                    return Err((uploaded_urls, e));
                }
            }
        }
        
        Ok(uploaded_urls)
    }
    
    fn generate_file_key(&self, field_name: &str, filename: &str) -> String {
        let uuid = Uuid::new_v4();
        let timestamp = chrono::Utc::now().timestamp();
        format!("{}/{}/{}/{}", timestamp, uuid, field_name, filename)
    }
}
```

### 4. Rozszerzenie modeli

**Plik**: `src/models/collection.rs`
```rust
// Dodać nową strukturę dla plików
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FileUpload {
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub data: String, // base64 encoded content
}

// Rozszerzyć CreateRecordRequest
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateRecordRequest {
    #[schema(example = json!({"name": "Product 1", "price": 99.99}))]
    pub data: Value,
    #[schema(example = json!({"avatar": {"filename": "photo.jpg", "content_type": "image/jpeg", "size": 1024, "data": "base64data..."}}))] 
    pub files: Option<HashMap<String, FileUpload>>, // field_name -> file_data
}
```

### 5. Modyfikacja CollectionService

**Plik**: `src/services/collection_service.rs`

#### Dodanie S3Service do struktury:
```rust
use crate::services::S3Service;

#[derive(Clone)]
pub struct CollectionService {
    pub pool: DbPool,
    pub websocket_service: Option<std::sync::Arc<crate::services::WebSocketService>>,
    pub permission_service: Option<PermissionService>,
    pub s3_service: Option<S3Service>, // NOWE
}

impl CollectionService {
    pub fn with_s3_service(mut self, s3_service: S3Service) -> Self {
        self.s3_service = Some(s3_service);
        self
    }
}
```

#### Nowa metoda do obsługi plików:
```rust
impl CollectionService {
    async fn process_file_uploads(
        &self,
        schema: &CollectionSchema,
        data: &mut Value,
        files: Option<HashMap<String, FileUpload>>,
    ) -> Result<Vec<String>, AuthError> {
        let s3_service = self.s3_service.as_ref()
            .ok_or_else(|| AuthError::InternalError)?;
        
        let files = match files {
            Some(f) => f,
            None => return Ok(Vec::new()),
        };
        
        // 1. Wykryj pola typu "file" w schemacie
        let file_fields: Vec<&str> = schema.fields
            .iter()
            .filter(|field| matches!(field.field_type, FieldType::File))
            .map(|field| field.name.as_str())
            .collect();
        
        let mut files_to_upload = HashMap::new();
        let mut uploaded_keys = Vec::new();
        
        // 2. Przygotuj pliki do uploadu
        for field_name in file_fields {
            if let Some(file_upload) = files.get(field_name) {
                let content = base64::decode(&file_upload.data)
                    .map_err(|_| AuthError::ValidationError(vec!["Invalid file data".to_string()]))?;
                
                files_to_upload.insert(
                    format!("{}/{}", field_name, file_upload.filename),
                    (Bytes::from(content), Some(file_upload.content_type.clone()))
                );
            }
        }
        
        // 3. Upload plików na S3
        let uploaded_urls = s3_service.upload_multiple_files(files_to_upload).await
            .map_err(|(_, e)| {
                tracing::error!("Failed to upload files to S3: {:?}", e);
                AuthError::InternalError
            })?;
        
        // 4. Zamień dane plików na URL-e w payload
        if let Some(data_obj) = data.as_object_mut() {
            for (file_path, url) in uploaded_urls {
                if let Some(field_name) = file_path.split('/').next() {
                    data_obj.insert(field_name.to_string(), Value::String(url));
                    uploaded_keys.push(file_path);
                }
            }
        }
        
        Ok(uploaded_keys)
    }
    
    async fn cleanup_uploaded_files(&self, file_keys: Vec<String>) {
        if let Some(s3_service) = &self.s3_service {
            for key in file_keys {
                if let Err(e) = s3_service.delete_file(&key).await {
                    tracing::error!("Failed to cleanup file {}: {:?}", key, e);
                }
            }
        }
    }
}
```

#### Modyfikacja create_record_with_events:
```rust
pub async fn create_record_with_events(
    &self,
    collection_name: &str,
    mut request: CreateRecordRequest,
    user_id: Option<i32>,
) -> Result<RecordResponse, AuthError> {
    let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

    // Find the collection
    let collection = collections::table
        .filter(collections::name.eq(collection_name))
        .first::<Collection>(&mut conn)
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Parse and validate data against schema
    let schema = collection
        .get_schema()
        .map_err(|_| AuthError::InternalError)?;

    // NOWE: Obsługa plików
    let uploaded_file_keys = match self.process_file_uploads(&schema, &mut request.data, request.files).await {
        Ok(keys) => keys,
        Err(e) => return Err(e),
    };

    let validated_data = self.validate_record_data(&schema, &request.data)?;

    // Build INSERT SQL for dynamic table
    let table_name = self.get_records_table_name(collection_name);
    let mut columns = Vec::new();
    let mut values = Vec::new();

    // Add schema-defined fields
    for field in &schema.fields {
        if let Some(field_value) = validated_data.get(&field.name) {
            columns.push(field.name.clone());
            let sql_value = self.value_to_sql_string(field_value, &field.field_type);
            values.push(sql_value);
        }
    }

    // Add ownership fields from request.data
    let ownership_fields = ["owner_id", "author_id"];
    for field_name in &ownership_fields {
        if let Some(field_value) = request.data.get(field_name) {
            if !columns.contains(&field_name.to_string()) {
                columns.push(field_name.to_string());
                let sql_value = self.value_to_sql_string(field_value, &FieldType::Number);
                values.push(sql_value);
            }
        }
    }

    let insert_sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        table_name,
        columns.join(", "),
        values.join(", ")
    );

    // Execute insert with error handling
    if let Err(e) = diesel::sql_query(&insert_sql).execute(&mut conn) {
        // Cleanup uploaded files in case of database error
        self.cleanup_uploaded_files(uploaded_file_keys).await;
        tracing::error!("Failed to insert record: {:?}", e);
        return Err(AuthError::InternalError);
    }

    // Get the inserted record
    let select_sql = format!("SELECT * FROM {} ORDER BY id DESC LIMIT 1", table_name);
    let record_response = self.query_record_by_sql(&mut conn, &select_sql, collection_name)?;

    // Emit WebSocket event
    let event = crate::models::RecordEvent::Created {
        record_id: record_response.id.to_string(),
        record: serde_json::to_value(&record_response.data).unwrap_or_default(),
    };
    self.emit_record_event(collection_name, event, user_id).await;

    Ok(record_response)
}
```

### 6. Modyfikacja handlera

**Plik**: `src/handlers/collections.rs`

```rust
use axum::extract::Multipart;
use std::collections::HashMap;
use base64;

#[utoipa::path(
    post,
    path = "/collections/{collection_name}/records",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name")
    ),
    request_body(content = CreateRecordRequest, content_type = "multipart/form-data"),
    responses(
        (status = 201, description = "Record created successfully", body = ApiResponse<RecordResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiResponse<RecordResponse>>), AuthError> {
    // Convert claims to user for ownership service
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| AuthError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

    let user = users::table
        .filter(users::id.eq(user_id))
        .select(crate::models::User::as_select())
        .first::<crate::models::User>(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))?;

    // Parse multipart data
    let mut data = serde_json::Map::new();
    let mut files = HashMap::new();
    
    while let Some(field) = multipart.next_field().await
        .map_err(|_| AuthError::ValidationError(vec!["Invalid multipart data".to_string()]))? {
        
        let name = field.name().unwrap_or("").to_string();
        
        if name.starts_with("file_") {
            // Handle file upload
            let field_name = name.strip_prefix("file_").unwrap().to_string();
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
            let file_data = field.bytes().await
                .map_err(|_| AuthError::ValidationError(vec!["Failed to read file".to_string()]))?;
            
            files.insert(field_name, crate::models::FileUpload {
                filename,
                content_type,
                size: file_data.len() as u64,
                data: base64::encode(&file_data),
            });
        } else {
            // Handle regular field
            let value = field.text().await
                .map_err(|_| AuthError::ValidationError(vec!["Invalid field data".to_string()]))?;
            
            // Try to parse as JSON, fallback to string
            let parsed_value = serde_json::from_str(&value)
                .unwrap_or(serde_json::Value::String(value));
            
            data.insert(name, parsed_value);
        }
    }
    
    let mut request = CreateRecordRequest {
        data: serde_json::Value::Object(data),
        files: if files.is_empty() { None } else { Some(files) },
    };

    // Get collection for permission checking
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await?;

    // Check collection-level create permission
    let has_permission = state
        .permission_service
        .check_collection_permission(&user, collection.id, crate::models::Permission::Create)
        .await?;

    if !has_permission {
        return Err(AuthError::InsufficientPermissions);
    }

    // Set ownership in record data
    state
        .ownership_service
        .set_record_ownership(&user, &mut request.data)?;

    let record = state
        .collection_service
        .create_record_with_events(&collection_name, request, Some(user_id))
        .await?;
        
    Ok((StatusCode::CREATED, Json(ApiResponse::success(record))))
}
```

### 7. Aktualizacja AppState i main.rs

**Plik**: `src/main.rs`
```rust
use crate::services::S3Service;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
    pub collection_service: CollectionService,
    pub permission_service: PermissionService,
    pub ownership_service: OwnershipService,
    pub websocket_service: std::sync::Arc<WebSocketService>,
    pub s3_service: S3Service, // NOWE
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ... existing setup code ...
    
    // Initialize S3 service
    let s3_service = S3Service::new(&config).await
        .expect("Failed to initialize S3 service");
    
    // Initialize services with S3
    let collection_service = CollectionService::new(pool.clone())
        .with_s3_service(s3_service.clone())
        .with_websocket_service(websocket_service.clone())
        .with_permission_service(permission_service.clone());
    
    let app_state = AppState {
        db_pool: pool,
        collection_service,
        permission_service,
        ownership_service,
        websocket_service,
        s3_service,
    };
    
    // ... rest of the setup ...
}
```

### 8. Aktualizacja services/mod.rs

**Plik**: `src/services/mod.rs`
```rust
pub mod admin_service;
pub mod collection_service;
pub mod email_service;
pub mod ownership_service;
pub mod permission_service;
pub mod websocket_service;
pub mod s3_service; // NOWE

pub use admin_service::AdminService;
pub use collection_service::CollectionService;
pub use email_service::EmailService;
pub use ownership_service::OwnershipService;
pub use permission_service::PermissionService;
pub use websocket_service::WebSocketService;
pub use s3_service::S3Service; // NOWE
```

## Przepływ działania

1. **Frontend** wysyła multipart/form-data z polami i plikami
2. **Handler** parsuje dane i pliki z multipart request
3. **CollectionService** wykrywa pola typu "file" w schemacie kolekcji
4. **S3Service** uploaduje pliki na S3 i zwraca URL-e
5. **CollectionService** zamienia dane plików na URL-e w payload
6. **CollectionService** waliduje dane i zapisuje rekord z URL-ami do bazy
7. W przypadku błędu przy zapisie - **S3Service** usuwa uploaded pliki (cleanup)
8. **WebSocket** emituje event o utworzeniu rekordu

## Testowanie

### Lokalne środowisko z LocalStack:

**Plik**: `docker-compose.yml`
```yaml
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
    volumes:
      - "./tmp/localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
```

### Zmienne środowiskowe dla testów:
```env
# Lokalne testowanie z LocalStack
S3_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
S3_BUCKET_NAME=test-bucket
```

### Inicjalizacja bucket w LocalStack:
```bash
# Uruchom LocalStack
docker-compose up -d

# Utwórz bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket

# Sprawdź bucket
aws --endpoint-url=http://localhost:4566 s3 ls
```

## Przykład użycia z frontendu

```javascript
// Frontend - wysyłanie pliku z formularzem
const formData = new FormData();
formData.append('name', 'Product Name');
formData.append('price', '99.99');
formData.append('file_avatar', fileInput.files[0]); // plik dla pola 'avatar'

fetch('/api/collections/products/records', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Bezpieczeństwo

1. **Walidacja typów plików** - dodać sprawdzanie MIME types
2. **Limity rozmiaru** - ograniczyć maksymalny rozmiar pliku
3. **Skanowanie antywirusowe** - opcjonalnie zintegrować z AWS S3 antivirus
4. **Presigned URLs** - dla bezpiecznego uploadu bezpośrednio z frontendu
5. **Encryption at rest** - włączyć szyfrowanie S3

## Monitoring i logowanie

1. **Metryki** - liczba uploadowanych plików, rozmiary, błędy
2. **Logi** - szczegółowe logowanie operacji S3
3. **Alerty** - powiadomienia o błędach uploadu
4. **Cleanup job** - okresowe usuwanie orphaned files

Ten plan zapewnia pełną implementację uploadu plików z obsługą błędów, cleanup'em i integracją z istniejącą architekturą Lunarbase.