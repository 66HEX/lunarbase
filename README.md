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
- **Dynamic rate limiting** with configurable request limits per IP
- **Timing attack protection** with consistent response delays
- **Real-time configuration management** allowing administrators to adjust security settings without server restart

### Granular Permission System
- **Multi-level access control** spanning collections, records, and individual fields
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
- **API rate limiting configuration** with customizable requests per minute per IP
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

## Configuration

### CLI Configuration (Primary Method)

Use the CLI for all server configuration:

```bash
# Show CLI help
cargo run -- --help

# Show serve command help
cargo run serve --help

# Start with defaults (127.0.0.1:3000)
cargo run serve

# Custom host and port  
cargo run serve --host 0.0.0.0 --port 8080

# Enable TLS
cargo run serve --tls --tls-cert /path/to/cert.pem --tls-key /path/to/key.pem

# API-only mode
cargo run serve --api-only --port 9000
```

### Environment Variables (.env file)

Create a `.env` file for non-server settings based on the provided `env.example` template.

### Required Configuration

#### Database Configuration
```bash
DATABASE_URL=db.sqlite         # SQLite database file path
SQLCIPHER_KEY=your-strong-encryption-password  # Database encryption key
```

#### Security Settings
```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PASSWORD_PEPPER=your-super-secret-pepper-change-this-in-production-and-keep-it-secret
```

#### Admin User Setup
```bash
LUNARBASE_ADMIN_EMAIL=admin@example.com      # Initial admin email
LUNARBASE_ADMIN_USERNAME=admin               # Initial admin username
LUNARBASE_ADMIN_PASSWORD=your-secure-admin-password  # Initial admin password
```

**Note:** These variables automatically create an admin user on first startup. Only the first admin can be created this way - subsequent admins must be created through the admin panel.

### Optional Configuration

#### Email Service (Resend)
```bash
RESEND_API_KEY=your-resend-api-key-from-resend-dashboard  # Get from https://resend.com
EMAIL_FROM=onboarding@resend.dev                          # Sender email address
```

#### OAuth Authentication
```bash
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id-from-google-cloud-console
GOOGLE_CLIENT_SECRET=your-google-client-secret-from-google-cloud-console

# GitHub OAuth (from GitHub Developer Settings)
GITHUB_CLIENT_ID=your-github-client-id-from-github-developer-settings
GITHUB_CLIENT_SECRET=your-github-client-secret-from-github-developer-settings
```

#### S3 File Storage
```bash
S3_BUCKET_NAME=your-bucket-name           # S3 bucket for file uploads
S3_REGION=us-east-1                       # AWS region
S3_ACCESS_KEY_ID=your-access-key-id       # AWS access key
S3_SECRET_ACCESS_KEY=your-secret-access-key  # AWS secret key
# S3_ENDPOINT_URL=http://localhost:4566   # Optional: Custom endpoint (LocalStack)
```

**Note:** All S3 variables are optional. If not set, file upload functionality will be disabled.

### Security Best Practices

- **Use strong, unique passwords** for `SQLCIPHER_KEY`, `JWT_SECRET`, and `PASSWORD_PEPPER`
- **Never commit secrets** to version control - use `.env` files locally and secure environment variable management in production
- **Rotate secrets regularly** especially JWT secrets and database encryption keys
- **Use HTTPS in production** by using `--tls` flag with valid SSL certificates

## Quick Start

### Development Mode

```bash
# Install dependencies
cargo build

# Start LocalStack for S3 testing (required for file upload functionality)
./start-with-localstack.sh

# Start the backend server with CLI
cargo run serve
# OR for development with custom settings:
cargo run serve --host localhost --port 3001

# In a separate terminal, start the admin interface
cd admin-ui
npm install
npm run dev

# Test WebSocket connections (in another terminal)
# With TLS enabled:
wscat -c wss://localhost:3000/api/ws --no-check

# With TLS disabled:
wscat -c ws://localhost:3000/api/ws

# Run unit and integration tests (in another terminal)
cargo test -- --test-threads=1

# Format code after modifications:
# Frontend (use biome.js for linting and formatting)
cd admin-ui && npx @biomejs/biome check --write

# Backend (use cargo fmt for code formatting)
cargo fmt

# Stop LocalStack when done
./stop-localstack.sh
```
#### Access Points

**CLI with TLS enabled:**
- Backend available at `https://localhost:3000/api/` with HTTP/2 support
- API documentation at `https://localhost:3000/docs/`
- Admin interface at `http://localhost:5173/admin/` (proxies API calls to HTTPS backend)

**CLI with TLS disabled (default):**
- Backend available at `http://localhost:3000/api/` with HTTP/1.1
- API documentation at `http://localhost:3000/docs/`
- Admin interface at `http://localhost:5173/admin/`

### Production Mode

#### Prerequisites

**1. Environment Configuration**
Create a `.env` file with required configuration. Copy from `env.example` and customize:

```bash
cp env.example .env
```

**Required .env variables:**
- `DATABASE_URL` - SQLite database file path
- `SQLCIPHER_KEY` - Strong encryption password for database
- `JWT_SECRET` - Secret key for JWT token signing
- `PASSWORD_PEPPER` - Additional security layer for password hashing
- `LUNARBASE_ADMIN_EMAIL` - Initial admin user email
- `LUNARBASE_ADMIN_USERNAME` - Initial admin username
- `LUNARBASE_ADMIN_PASSWORD` - Initial admin password

**Optional but recommended:**
- `RESEND_API_KEY` - For email verification (get from https://resend.com)
- `EMAIL_FROM` - Sender email address
- OAuth credentials (Google/GitHub)
- S3 configuration for file uploads

**2. CLI Configuration**

Server settings are configured via CLI arguments:

```bash
# Basic server setup
./lunarbase serve --host 0.0.0.0 --port 443

# With TLS for production
./lunarbase serve --host 0.0.0.0 --port 443 --tls --tls-cert /path/to/cert.pem --tls-key /path/to/key.pem
```

#### Build and Deploy

```bash
# Build the application with embedded admin UI
cargo build --release

# Start the production server with CLI (serves both API and embedded admin UI)
./target/release/lunarbase serve --host 0.0.0.0 --port 3000

# Or with TLS for production
./target/release/lunarbase serve --host 0.0.0.0 --port 443 --tls --tls-cert /etc/ssl/cert.pem --tls-key /etc/ssl/key.pem
```

**Note:** The admin UI is automatically built and embedded into the binary during compilation. No separate frontend build step is required.

#### Access Points

**CLI with TLS enabled:**
- Backend available at `https://localhost:443/api/` with HTTP/2 support
- Admin interface at `https://localhost:443/admin/`
- API documentation at `https://localhost:443/docs/`

**CLI with TLS disabled:**
- Backend available at `http://localhost:3000/api/` with HTTP/1.1
- Admin interface at `http://localhost:3000/admin/`
- API documentation at `http://localhost:3000/docs/`

## Architecture Highlights

### Security-First Design
Every component has been designed with security as a primary concern. From the Argon2id password hashing to the comprehensive permission system, LunarBase helps protect your data against modern threats.

### Real-time Capabilities
Built-in WebSocket support provides real-time updates across the entire system. Whether it's live data synchronization or instant permission changes, LunarBase keeps all clients synchronized without compromising security.

### Scalable Architecture
The Rust backend provides exceptional performance and memory safety, while the React frontend with Nocta UI delivers a responsive, accessible interface that scales from small teams to enterprise deployments. The single binary deployment with embedded assets simplifies production deployment and eliminates the need for separate frontend hosting.

### Developer Experience
With comprehensive TypeScript support, automatic API documentation, and the intuitive Nocta UI component library, LunarBase provides an exceptional developer experience without sacrificing functionality or security.

---

LunarBase provides secure, real-time database management—where robust security meets modern user experience, all powered by the Nocta UI component library.

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