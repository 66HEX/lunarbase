# Changelog

## [Unreleased]

### Added
- Language syntax highlighting selector in RichTextEditor CodeBlock component for improved code editing experience
- Language indicator badge in RichTextEditor CodeBlock showing the selected programming language in the top-right corner
- Image upload functionality in RichTextEditor with S3 integration
- Automatic image deletion from S3 when images are removed from RichTextEditor content
- DELETE `/api/delete-image` endpoint for removing uploaded images from S3 storage
- Support for both AWS S3 and LocalStack image storage and deletion
- Real-time image tracking in RichTextEditor to detect content changes and cleanup unused files

### Fixed
- Sheet close button functionality when Select components are opened and closed without making a selection in CreateUserSheet and EditUserSheet
- Sheet close button functionality when Select components are opened and closed without making a selection in CreateCollectionSheet and EditCollectionSheet
- Consistent allowClose state management across all sheet components to prevent UI blocking

### Improved
- Custom formatting for all toolbar buttons in RichTextEditor with gradient effects and consistent styling
- Enhanced visual appearance of RichTextEditor toolbar with improved active state indicators
- Added gradient spans with conditional rendering for all formatting buttons (bold, italic, strike, code, headings, lists, etc.)
- Automatic sheet size adjustment to 'xxl' for collections containing richtext fields in CreateRecordSheet, EditRecordSheet, and CollectionRecordsEditSheet
- Added hasRichTextField helper function to detect collections with richtext fields and dynamically adjust sheet dimensions
- Tab key handling in RichTextEditor CodeBlock now inserts indentation (two spaces) instead of changing focus to other elements

## [0.5.0][0.5.0] - 2025-08-30

### Added
- Protection against accidental sheet closure during select interactions in CreateRecordSheet
- Zod validation schemas for all frontend settings forms with comprehensive validation rules
- Reusable validation functions in backend configuration handlers for consistent validation logic
- Extended admin health endpoint with total users count information
- Users count card in dashboard replacing system health overview
- Support for 'richtext' field type in backend (enum in models/collection.rs, handling in collection_service.rs) and frontend (api.ts, constants.ts, validation.ts)
- TipTap-based RichTextEditor component for editing rich text fields in records
- Integration of RichTextEditor in CollectionRecordsEditSheet.tsx with JSON content handling and error fixes
- Resizable Sheet component: respects size variant widths/heights and allows one-time expansion via draggable edges
- Touch support for sheet resizing on mobile and tablet

### Changed
- Migrated from Lucide React to Phosphor Icons throughout the entire admin UI for consistent iconography
- Updated updateFormData in CreateRecordSheet.tsx and EditRecordSheet.tsx to handle unknown values for richtext

### Improved
- Backend settings validation refactored to use centralized validation functions (`validate_category`, `validate_data_type`, `validate_setting_key`) across all configuration endpoints
- Frontend settings panels (Database, Auth, API) now validate input values before submission using Zod schemas that mirror backend validation logic
- Enhanced error handling in settings forms with descriptive validation messages and proper user feedback
- Optimized chunking in Vite configuration by splitting manualChunks into more granular groups for better bundle size and loading performance
- Added mention of RichText field and RichTextEditor in README.md

## [0.4.0][0.4.0] - 2025-08-28

### Added
- Collection description field support in CreateCollectionSheet, EditCollectionSheet, and CollectionDetailsSheet
- Change way of animating active route on sidebar for better UX
- Prefetching permissions when hovering over collection settings button to prevent UI flickering
- Protection against accidental sheet closure during select interactions in EditCollectionSheet

### Fixed
- Fixed automatic data refresh after user edits by adding proper React Query cache invalidation for all user queries

### Improved
- Display username instead of owner ID in ownership column for better user experience
- Removed all unnecessary development comments from codebase for cleaner production code
- Enhanced prefetching system to include ownership user data when navigating to records
- Standardized toast positioning with consistent animation configurations
- Completely rewritten CollectionPermissionsSheet for better UX with clear separation between permission types (role-based vs user-specific)
- Redesigned UserDetailsSheet with improved layout structure, organized sections, and consistent styling matching CollectionDetailsSheet
- Redesigned UserDetailsSheet into a single clean overview section
- Implemented tabbed interface in CreateCollectionSheet and EditCollectionSheet with "Overview" and "Schema Fields" sections for better organization and user experience
- Updated EmptyRecordsState component to use CreateCollectionSheet instead of navigation link for consistent UX pattern

### Refactored
- Toast system migrated from GSAP to CSS transition-driven animations, centralized easing, and improved accessibility
- Moved CollectionPermissionsSheet from modals to sheets state management for consistency with Sheet component usage

### Performance
- Frontend build: enabled Lightning CSS transformer and minifier for CSS to reduce CSS size and speed up builds
- Frontend build: tightened Terser minification (toplevel mangle, pure_getters, 2 passes, no comments) to reduce JS bundle size
- Dev: added lightningcss as a devDependency

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


[0.5.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.5.0
[0.4.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.4.0
[0.3.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.3.0
[0.2.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.2.0
[0.1.1]: https://github.com/66HEX/lunarbase/releases/tag/v0.1.1
[0.1.0]: https://github.com/66HEX/lunarbase/releases/tag/v0.1.0
