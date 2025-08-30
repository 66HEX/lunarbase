use aws_config::BehaviorVersion;
use aws_sdk_s3::Client;
use chrono::{DateTime, Utc};
use tracing::debug;
use uuid::Uuid;

#[derive(Clone)]
pub struct S3Service {
    client: Client,
    bucket_name: String,
    endpoint_url: Option<String>,
}

#[derive(Debug)]
pub struct FileUploadResult {
    pub file_id: String,
    pub file_url: String,
    pub original_filename: String,
    pub file_size: u64,
    pub content_type: String,
}

#[derive(Debug)]
pub struct S3Object {
    pub key: String,
    pub last_modified: DateTime<Utc>,
    pub size: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum S3ServiceError {
    #[error("S3 error: {0}")]
    S3Error(#[from] aws_sdk_s3::Error),
    #[error("S3 SDK error: {0}")]
    SdkError(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Upload error: {0}")]
    UploadError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl S3Service {
    pub async fn new(
        bucket_name: String,
        region: Option<String>,
        access_key_id: Option<String>,
        secret_access_key: Option<String>,
        endpoint_url: Option<String>,
    ) -> Result<Self, S3ServiceError> {
        let mut config_loader = aws_config::defaults(BehaviorVersion::latest());

        if let Some(region) = region {
            config_loader = config_loader.region(aws_config::Region::new(region));
        }

        if let Some(endpoint) = endpoint_url.clone() {
            config_loader = config_loader.endpoint_url(endpoint);
        }

        if let (Some(access_key), Some(secret_key)) = (access_key_id, secret_access_key) {
            let credentials = aws_sdk_s3::config::Credentials::new(
                access_key,
                secret_key,
                None,
                None,
                "lunarbase",
            );
            config_loader = config_loader.credentials_provider(credentials);
        }

        let config = config_loader.load().await;

        let mut s3_config_builder = aws_sdk_s3::config::Builder::from(&config);

        if let Some(ref _endpoint) = endpoint_url {
            s3_config_builder = s3_config_builder.force_path_style(true);
        }

        let s3_config = s3_config_builder.build();
        let client = Client::from_conf(s3_config);

        match client.head_bucket().bucket(&bucket_name).send().await {
            Ok(_) => {}
            Err(e) => {
                tracing::warn!(
                    "Could not access S3 bucket '{}': {}. File upload will be disabled.",
                    bucket_name,
                    e
                );
                return Err(S3ServiceError::ConfigError(format!(
                    "Cannot access bucket '{}': {}",
                    bucket_name, e
                )));
            }
        }

        Ok(Self {
            client,
            bucket_name,
            endpoint_url,
        })
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        original_filename: String,
        content_type: String,
    ) -> Result<FileUploadResult, S3ServiceError> {
        let file_id = Uuid::new_v4().to_string();
        let file_extension = std::path::Path::new(&original_filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        let s3_key = if file_extension.is_empty() {
            format!("uploads/{}", file_id)
        } else {
            format!("uploads/{}.{}", file_id, file_extension)
        };

        let file_size = file_data.len() as u64;
        let byte_stream = aws_sdk_s3::primitives::ByteStream::from(file_data);

        let _result = self
            .client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&s3_key)
            .content_type(&content_type)
            .content_length(file_size as i64)
            .body(byte_stream)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;

        let file_url = if let Some(ref endpoint) = self.endpoint_url {
            format!("{}/{}/{}", endpoint, self.bucket_name, s3_key)
        } else {
            format!("https://{}.s3.amazonaws.com/{}", self.bucket_name, s3_key)
        };

        debug!(
            "Successfully uploaded file '{}' to S3 with key '{}'",
            original_filename, s3_key
        );

        Ok(FileUploadResult {
            file_id,
            file_url,
            original_filename,
            file_size,
            content_type,
        })
    }

    pub async fn upload_file_with_key(
        &self,
        file_data: Vec<u8>,
        s3_key: String,
        original_filename: String,
        content_type: String,
    ) -> Result<FileUploadResult, S3ServiceError> {
        let file_size = file_data.len() as u64;
        let byte_stream = aws_sdk_s3::primitives::ByteStream::from(file_data);

        let _result = self
            .client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&s3_key)
            .content_type(&content_type)
            .content_length(file_size as i64)
            .body(byte_stream)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;

        let file_url = if let Some(endpoint_url) = &self.endpoint_url {
            format!("{}/{}/{}", endpoint_url, self.bucket_name, s3_key)
        } else {
            format!("https://{}.s3.amazonaws.com/{}", self.bucket_name, s3_key)
        };

        debug!(
            "Successfully uploaded file '{}' to S3 with key '{}'",
            original_filename, s3_key
        );

        Ok(FileUploadResult {
            file_id: s3_key.clone(),
            file_url,
            original_filename,
            file_size,
            content_type,
        })
    }

    pub async fn upload_files(
        &self,
        files: Vec<(Vec<u8>, String, String)>,
    ) -> Result<Vec<FileUploadResult>, S3ServiceError> {
        let mut results = Vec::new();
        let mut uploaded_keys = Vec::new();

        for (file_data, filename, content_type) in files {
            match self
                .upload_file(file_data, filename.clone(), content_type)
                .await
            {
                Ok(result) => {
                    uploaded_keys.push(result.file_url.clone());
                    results.push(result);
                }
                Err(e) => {
                    self.cleanup_files(uploaded_keys).await;
                    return Err(e);
                }
            }
        }

        Ok(results)
    }

    pub async fn delete_file(&self, file_url: &str) -> Result<(), S3ServiceError> {
        let s3_key = self.extract_s3_key_from_url(file_url)?;

        self.client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(&s3_key)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;

        debug!("Successfully deleted file with key '{}' from S3", s3_key);
        Ok(())
    }

    pub async fn cleanup_files(&self, file_urls: Vec<String>) {
        for file_url in file_urls {
            if let Err(e) = self.delete_file(&file_url).await {
                tracing::error!("Failed to cleanup file '{}': {}", file_url, e);
            }
        }
    }

    fn extract_s3_key_from_url(&self, file_url: &str) -> Result<String, S3ServiceError> {
        if file_url.contains(&format!("{}.s3.amazonaws.com", self.bucket_name)) {
            let parts: Vec<&str> = file_url
                .split(&format!("{}.s3.amazonaws.com/", self.bucket_name))
                .collect();
            if parts.len() == 2 {
                return Ok(parts[1].to_string());
            }
        } else if file_url.contains("s3.amazonaws.com") {
            let parts: Vec<&str> = file_url
                .split(&format!("s3.amazonaws.com/{}/", self.bucket_name))
                .collect();
            if parts.len() == 2 {
                return Ok(parts[1].to_string());
            }
        } else if file_url.contains("localhost:4566") || file_url.contains("127.0.0.1:4566") {
            let parts: Vec<&str> = file_url.split(&format!("/{}/", self.bucket_name)).collect();
            if parts.len() == 2 {
                return Ok(parts[1].to_string());
            }
        } else if file_url.contains(&self.bucket_name) {
            let parts: Vec<&str> = file_url.split(&format!("/{}/", self.bucket_name)).collect();
            if parts.len() == 2 {
                return Ok(parts[1].to_string());
            }
        }

        Err(S3ServiceError::UploadError(format!(
            "Cannot extract S3 key from URL: {}",
            file_url
        )))
    }

    pub async fn health_check(&self) -> Result<(), S3ServiceError> {
        self.client
            .head_bucket()
            .bucket(&self.bucket_name)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;
        Ok(())
    }

    pub async fn list_objects(&self, prefix: &str) -> Result<Vec<S3Object>, S3ServiceError> {
        let response = self
            .client
            .list_objects_v2()
            .bucket(&self.bucket_name)
            .prefix(prefix)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;

        let mut objects = Vec::new();
        for object in response.contents() {
            if let (Some(key), Some(last_modified), Some(size)) =
                (object.key(), object.last_modified(), object.size())
            {
                let chrono_datetime = DateTime::<Utc>::from_timestamp(
                    last_modified.secs(),
                    last_modified.subsec_nanos(),
                )
                .unwrap_or_else(|| Utc::now());

                objects.push(S3Object {
                    key: key.to_string(),
                    last_modified: chrono_datetime,
                    size: size as u64,
                });
            }
        }

        Ok(objects)
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), S3ServiceError> {
        self.client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await
            .map_err(|e| S3ServiceError::SdkError(e.to_string()))?;

        debug!("Successfully deleted object with key '{}' from S3", key);
        Ok(())
    }

    pub fn bucket_name(&self) -> &str {
        &self.bucket_name
    }
}

pub async fn create_s3_service_from_config(
    config: &crate::config::Config,
) -> Result<Option<S3Service>, S3ServiceError> {
    let bucket_name = match &config.s3_bucket_name {
        Some(name) => name.clone(),
        None => {
            debug!("S3_BUCKET_NAME not configured, file upload will be disabled");
            return Ok(None);
        }
    };

    match S3Service::new(
        bucket_name,
        config.s3_region.clone(),
        config.s3_access_key_id.clone(),
        config.s3_secret_access_key.clone(),
        config.s3_endpoint_url.clone(),
    )
    .await
    {
        Ok(service) => {
            debug!("S3Service initialized successfully");
            Ok(Some(service))
        }
        Err(e) => {
            tracing::warn!(
                "Failed to initialize S3Service: {}. File upload will be disabled.",
                e
            );
            Ok(None)
        }
    }
}
