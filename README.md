![LunarBase](lunar.png)

# LunarBase

A security-first database management platform that combines the power of Rust's performance with React's flexibility. LunarBase delivers reliable data management through an intuitive admin interface built entirely with the proprietary **Nocta UI** component library.

## Why LunarBase?

LunarBase is a comprehensive platform designed for organizations that prioritize security while requiring modern, real-time capabilities. Built with a security-first mindset, every component has been designed to protect your data while providing the flexibility and performance modern applications require.

## Security at the Core

Security isn't an afterthought in LunarBase—it's the foundation. Our multi-layered security architecture ensures your data remains protected at every level:

### Advanced Authentication & Authorization
- **Secure password hashing** with Argon2id (65536 memory, 4 iterations, 2 parallelism)
- **Password pepper protection** with server-side secret salt to defend against rainbow table attacks
- **Dynamic JWT system** with configurable token lifetime and refresh token duration
- **HttpOnly cookies** with secure, SameSite=Lax configuration and path restrictions
- **Comprehensive token blacklisting** for immediate session revocation
- **Configurable brute force protection** with customizable lockout duration and maximum login attempts
- **Static rate limiting** with tower-governor middleware using GCRA algorithm for optimal performance
- **Timing attack protection** with consistent response delays
- **Real-time configuration management** allowing administrators to adjust security settings without server restart

### Granular Permission System
- **Multi-level access control** spanning collections and records
- **Role-based hierarchy** with user/admin distinction and custom permission overrides
- **Ownership-based permissions** with automatic owner privilege assignment
- **Real-time permission validation** for WebSocket connections and live data
- **Admin self-protection** mechanisms to prevent accidental privilege removal

### Data Protection & Integrity
- **Database encryption at rest** with SQLCipher providing transparent AES-256 encryption
- **SQL injection prevention** through parameterized queries and comprehensive input validation
- **CSRF protection** via SameSite cookie policies
- **XSS prevention** through httpOnly cookie storage and input sanitization
- **Schema validation** to prevent malicious data structure modifications
- **Audit trails** for all operations with comprehensive logging

## Powered by Nocta UI

The LunarBase admin panel showcases **Nocta UI**, our proprietary component library designed for modern web interfaces:

### Modern Component Architecture
- **Copy-paste philosophy** - Components are copied directly into your project for complete customization control
- **WCAG 2.1 AA compliance** with full keyboard navigation and screen reader support
- **First-class dark mode** with automatic system detection and manual override
- **TypeScript-native** with intuitive APIs and comprehensive type safety
- **Performance-optimized** components with minimal complexity and maximum efficiency

### Comprehensive Component Ecosystem
- **Form elements**: Button, Input, Textarea, Checkbox, Select, Switch with advanced validation
- **Layout components**: Card, Sheet, Dialog, Tabs, Table, Breadcrumb for structured interfaces
- **Feedback systems**: Alert, Badge, Toast, Spinner, Progress, Tooltip for user communication
- **Interactive elements**: Popover and context-aware components for enhanced UX

## Core Features

### Dynamic Collection Management
- **Flexible schema system** supporting Text, Number, Boolean, Date, Email, URL, JSON, RichText, File, and Relation fields
- **Real-time schema evolution** with automatic table creation and validation
- **Advanced field validation** with min/max constraints, regex patterns, and enum values
- **System field protection** for created_at, updated_at, and other reserved fields

### Intelligent Query Engine
- **Advanced filtering** with comprehensive operators (eq, ne, gt, gte, lt, lte, like, in, null checks)
- **Multi-field sorting** with ascending/descending directions
- **Full-text search** across record fields with performance optimization
- **Efficient pagination** with offset/limit support for large datasets
- **Schema-aware validation** ensuring query safety and field checking

### Real-time WebSocket System
- **Authenticated and anonymous connections** with automatic UUID assignment
- **Subscription-based architecture** for collections, records, and custom queries
- **Automatic CRUD event emission** with before/after data for updates
- **Permission-based event filtering** ensuring users only receive authorized data
- **Admin broadcasting capabilities** for system-wide notifications

### Comprehensive User Management
- **Complete CRUD operations** with admin-only access controls
- **Advanced user filtering** by email, username, verification status
- **Account lock management** with unlock capabilities
- **Role assignment** with dynamic permission inheritance
- **Self-protection mechanisms** preventing admin self-deletion

### Enterprise Monitoring
- **Prometheus integration** with comprehensive metrics collection
- **Real-time performance monitoring** for HTTP requests, WebSocket connections, and database operations
- **Custom dashboard** with live statistics and health indicators
- **Activity logging** with detailed audit trails and pagination
- **Resource usage tracking** with memory and connection pool monitoring

### Dynamic Configuration System
- **Real-time settings management** with immediate effect without server restart
- **Database-backed configuration** with automatic caching and cache invalidation
- **Authentication settings control** including JWT lifetime (1-168 hours), lockout duration (1-1440 minutes), and max login attempts (1-20)
- **Static rate limiting** with 100 requests/second limit and burst capacity of 10 requests per IP
- **CORS settings management** with dynamic allowed origins configuration
- **Admin interface integration** providing intuitive controls for all configurable parameters
- **Fallback to secure defaults** ensuring system stability even with missing configuration
- **Configuration validation** with type checking and range constraints

### Automated Backup System
- **Scheduled database backups** with configurable cron expressions (default: daily at 2 AM)
- **S3 cloud storage integration** for secure, off-site backup storage
- **Gzip compression** to minimize storage costs and transfer times
- **Intelligent retention management** with automatic cleanup of old backups based on configurable retention periods
- **Backup validation** with minimum size checks to prevent corrupted backup cleanup
- **Comprehensive monitoring** with Prometheus metrics for backup success/failure rates
- **SQLCipher VACUUM INTO** for atomic, consistent database snapshots
- **Configurable backup settings** including schedule, retention days, compression, and file naming
- **Health monitoring** with backup service status checks and S3 connectivity validation

### Self-Contained Server Architecture
- **Native TLS/SSL support** with HTTP/2 protocol and automatic certificate management
- **Automatic HTTPS with ACME/Let's Encrypt** - zero-configuration SSL certificate provisioning and renewal
- **Production and staging ACME environments** with automatic certificate caching and renewal
- **Automatic HTTP→HTTPS redirect** server for seamless security enforcement
- **Automatic port configuration** - 443/80 for production with ACME, 3000 for development
- **Zero external dependencies** - no need for Nginx or other reverse proxies
- **Production-ready deployment** with comprehensive security headers and compression

### External Integrations
- **OAuth Authentication** with Google and GitHub providers for seamless social login
- **Resend Email Service** for reliable verification email delivery
- **S3 File Storage** with secure file upload capabilities

## Technology Stack

### Backend (Rust)
- **Axum 0.8.4** - High-performance async web framework
- **Diesel 2.2.11** - Type-safe ORM with compile-time query validation
- **SQLCipher** - Encrypted embedded database with excellent performance characteristics and transparent encryption
- **JWT + Argon2** - Industry-standard authentication with cryptographic security
- **tokio-tungstenite** - Async WebSocket implementation
- **Prometheus** - Production-ready metrics and monitoring
- **utoipa** - OpenAPI documentation generation

### Frontend (TypeScript/React)
- **React 19.1.0** - Latest React with concurrent features
- **TanStack Router 1.128.0** - Type-safe routing with automatic code splitting
- **Zustand 5.0.6** - Lightweight state management
- **TanStack Query 5.83.0** - Powerful server state management with caching
- **Tailwind CSS 4.1.11** - Utility-first CSS framework
- **Vite 7.0.4** - Lightning-fast build tool with HMR

## Architecture Highlights

### Security-First Design
Every component has been designed with security as a primary concern. From the Argon2id password hashing to the comprehensive permission system, LunarBase helps protect your data against modern threats.

### Real-time Capabilities
Built-in WebSocket support provides real-time updates across the entire system. Whether it's live data synchronization or instant permission changes, LunarBase keeps all clients synchronized without compromising security.

### Scalable Architecture
The Rust backend provides exceptional performance and memory safety, while the React frontend with Nocta UI delivers a responsive, accessible interface that scales from small teams to enterprise deployments. The single binary deployment with embedded assets simplifies production deployment and eliminates the need for separate frontend hosting.

### Developer Experience
With comprehensive TypeScript support, automatic API documentation, and the intuitive Nocta UI component library, LunarBase provides an exceptional developer experience without sacrificing functionality or security.

## Contributing

We welcome contributions to LunarBase! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### How to Contribute

1. **Fork the repository** and create your feature branch from `main`
2. **Make your changes** following the existing code style and conventions
3. **Add tests** for any new functionality
4. **Ensure all tests pass** by running ` cargo test -- --test-threads=1  `
5. **Update documentation** if you're adding new features
6. **Submit a pull request** with a clear description of your changes

### Code of Conduct

Please be respectful and constructive in all interactions. We're committed to providing a welcoming environment for all contributors.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.