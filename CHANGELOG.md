# Changelog

## [Unreleased]

### Added
- Change way of animating active route on sidebar for better UX

### Refactored
- Toast system migrated from GSAP to CSS transition-driven animations, centralized easing, and improved accessibility

## [0.3.0][0.3.0] - 2025-08-19

### Added
- Manual backup endpoint (POST /admin/backup) for on-demand database backups
- Manual backup button in Database Settings panel
- Backup health check endpoint (GET /admin/backup/health)
- Enhanced backup API with proper error handling and notifications
- Added missing text colors to default toast variant
- Comprehensive JSDoc documentation for all React hooks
- WAL (Write-Ahead Logging) mode for SQLCipher database for improved concurrency and performance

### Fixed
- ESLint errors and warnings in admin-ui frontend code
- Fast refresh compatibility issues by separating toast logic into dedicated module
- React Hook dependency warnings in useEffect and useCallback hooks
- Missing and unnecessary dependencies in React components

### Improved
- Cleaned up hooks folder structure by removing redundant hooks
- Optimized and standardized hook imports across the project
- Optimized prefetch hook with cache checking to prevent unnecessary network requests

## [0.2.0][0.2.0] - 2025-08-17

### Added
- Search functionality integrated into search engine
- Prefetching data when hovering dashboard links for improved performance
- Prefetching data when hovering sidebar links for improved performance

### Changed
- Standardized debounce implementation using useDebounce hook across all views

### Performance
- Cached CPU usage via background sampler to reduce latency

## [0.1.1][0.1.1] - 2025-08-16

### Added
- Extended build optimization for better performance
- Embedded UI into binary for single-file deployment
- Debug tracing with selective information hiding

### Fixed
- OAuth logging when using HTTPS connections
- Frontend proxy configuration issues
- CreateUserSheet closing when select value changes
- Unified argon2id hash parameters for consistency

### Removed
- Unused handlers to reduce binary size

## [0.1.0][0.1.0] - 2025-08-15

### Added

- First stable release of **LunarBase** 
- Complete backend in Rust with security-first architecture (Argon2id, JWT, SQLCipher, rate limiting, brute force protection)
- Fully integrated React admin panel powered by **Nocta UI** component library
- Real-time WebSocket system with granular permission control
- Dynamic schema management with advanced validation and system field protection
- Intelligent query engine with filtering, sorting, pagination, and full-text search
- Enterprise monitoring with Prometheus integration and custom dashboard
- Dynamic configuration system with runtime changes without server restart
- Automated backup system with S3 support, compression, and retention policies
- OAuth authentication (Google, GitHub) and secure S3 file storage
- Comprehensive audit logging and activity monitoring


[0.3.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.3.0
[0.2.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.2.0
[0.1.1]: https://github.com/66HEX/lunarbase/releases/tag/v0.1.1
[0.1.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.1.0
