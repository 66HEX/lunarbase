use serde::{Deserialize, Serialize};
use tower_http::compression::{CompressionLayer, CompressionLevel};
use tracing::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionConfig {
    pub enabled: bool,
    pub level: u8,
    pub min_size: usize,
    pub algorithms: CompressionAlgorithms,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionAlgorithms {
    pub gzip: bool,
    pub brotli: bool,
    pub deflate: bool,
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            level: 6,
            min_size: 1024,
            algorithms: CompressionAlgorithms::default(),
        }
    }
}

impl Default for CompressionAlgorithms {
    fn default() -> Self {
        Self {
            gzip: true,
            brotli: true,
            deflate: true,
        }
    }
}

impl CompressionConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn production() -> Self {
        Self {
            enabled: true,
            level: 6,
            min_size: 1024,
            algorithms: CompressionAlgorithms {
                gzip: true,
                brotli: true,
                deflate: true,
            },
        }
    }

    pub fn development() -> Self {
        Self {
            enabled: true,
            level: 1,
            min_size: 512,
            algorithms: CompressionAlgorithms {
                gzip: true,
                brotli: false,
                deflate: false,
            },
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.level < 1 || self.level > 9 {
            return Err("Compression level must be between 1 and 9".to_string());
        }

        if self.min_size > 10 * 1024 * 1024 {
            return Err("Minimum compression size cannot exceed 10MB".to_string());
        }

        if !self.algorithms.gzip && !self.algorithms.brotli && !self.algorithms.deflate {
            return Err("At least one compression algorithm must be enabled".to_string());
        }

        Ok(())
    }
}

pub fn create_compression_layer(config: &CompressionConfig) -> Result<CompressionLayer, String> {
    if !config.enabled {
        debug!("Compression is disabled in configuration");
        return Ok(CompressionLayer::new().no_br().no_gzip().no_deflate());
    }

    config.validate()?;

    let compression_level = match config.level {
        1..=3 => CompressionLevel::Fastest,
        4..=6 => CompressionLevel::Default,
        7..=9 => CompressionLevel::Best,
        _ => {
            warn!("Invalid compression level {}, using default", config.level);
            CompressionLevel::Default
        }
    };

    debug!(
        "Creating compression layer: level={}, algorithms=[gzip={}, brotli={}, deflate={}]",
        config.level, config.algorithms.gzip, config.algorithms.brotli, config.algorithms.deflate
    );

    let mut layer = CompressionLayer::new().quality(compression_level);

    if !config.algorithms.gzip {
        layer = layer.no_gzip();
    }
    if !config.algorithms.brotli {
        layer = layer.no_br();
    }
    if !config.algorithms.deflate {
        layer = layer.no_deflate();
    }

    Ok(layer)
}

pub struct CompressionMetrics {
    pub total_requests: u64,
    pub compressed_requests: u64,
    pub compression_ratio: f64,
    pub bytes_saved: u64,
}

impl CompressionMetrics {
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            compressed_requests: 0,
            compression_ratio: 0.0,
            bytes_saved: 0,
        }
    }

    pub fn compression_percentage(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            (self.compressed_requests as f64 / self.total_requests as f64) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compression_config_validation() {
        let mut config = CompressionConfig::default();
        assert!(config.validate().is_ok());

        config.level = 0;
        assert!(config.validate().is_err());

        config.level = 10;
        assert!(config.validate().is_err());

        config.level = 6;
        config.min_size = 20 * 1024 * 1024;
        assert!(config.validate().is_err());

        config.min_size = 1024;
        config.algorithms = CompressionAlgorithms {
            gzip: false,
            brotli: false,
            deflate: false,
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_compression_layer_creation() {
        let config = CompressionConfig::production();
        let layer = create_compression_layer(&config);
        assert!(layer.is_ok());

        let disabled_config = CompressionConfig {
            enabled: false,
            ..Default::default()
        };
        let disabled_layer = create_compression_layer(&disabled_config);
        assert!(disabled_layer.is_ok());
    }

    #[test]
    fn test_compression_presets() {
        let prod_config = CompressionConfig::production();
        assert_eq!(prod_config.level, 6);
        assert!(prod_config.enabled);

        let dev_config = CompressionConfig::development();
        assert_eq!(dev_config.level, 1);
        assert!(dev_config.enabled);
        assert!(!dev_config.algorithms.brotli);
    }
}
