# IronBase

**🔥 A production-ready Backend-as-a-Service (BaaS) built with Rust**

IronBase is a high-performance, secure backend solution inspired by PocketBase, built from the ground up using Rust with Axum, SQLite, and Diesel ORM. Designed to provide developers with a fast, reliable, and easy-to-use backend for web and mobile applications.

## 🚀 Current Status

IronBase is actively under development with **Phase 3** completed. The foundation, authentication system, and dynamic collections are production-ready.

### ✅ **Completed Features**

#### 🏗️ **Phase 1: Foundation** 
- [x] **Modular Architecture** - Clean separation of concerns with proper folder structure
- [x] **Database Layer** - SQLite with Diesel ORM and connection pooling
- [x] **HTTP Server** - Axum-based server with routing and middleware
- [x] **Health Monitoring** - Health check endpoint with status reporting
- [x] **Graceful Shutdown** - Proper signal handling for production deployments
- [x] **Logging & Tracing** - Structured logging with request tracing
- [x] **CORS Support** - Cross-origin resource sharing configuration

#### 🔐 **Phase 2: Authentication & Security**
- [x] **User Management** - Complete user model with validation
- [x] **Secure Authentication** - Production-grade auth system with:
  - **Argon2 Password Hashing** - Industry-standard password security
  - **JWT Tokens** - Short-lived access tokens (15min) + refresh tokens (7 days)
  - **Account Security** - Account lockout after failed attempts
  - **Timing Attack Protection** - Constant-time operations for security
  - **Rate Limiting** - Request throttling to prevent abuse
  - **Input Validation** - Comprehensive request sanitization
- [x] **API Endpoints**:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User authentication  
  - `POST /api/auth/refresh` - Token refresh
  - `GET /api/auth/me` - Protected user profile
- [x] **Security Middleware** - Request validation and token verification
- [x] **Error Handling** - Production-safe error responses (no data leakage)

#### 🗃️ **Phase 3: Dynamic Collections System**
- [x] **Dynamic Table Creation** - Each collection gets its own SQL table (not JSON storage)
- [x] **Production-Ready Schema Management** - Field types mapped to native SQL columns
- [x] **Full CRUD Operations** - Create, read, update, delete collections and records
- [x] **Advanced Type System** - 9 field types with proper validation:
  - **Text** - String fields with length validation
  - **Number** - Integer/float with automatic type detection
  - **Boolean** - True/false values
  - **Date** - Timestamp fields
  - **Email** - Email validation
  - **URL** - URL validation  
  - **JSON** - Structured data storage
  - **File** - File references
  - **Relation** - Inter-collection relationships
- [x] **Query Engine** - Filtering, sorting, and pagination for records
- [x] **Field Validation** - Schema enforcement with custom rules
- [x] **SQL Performance** - Native SQL queries with proper indexing
- [x] **Collections API**:
  - `GET /api/collections` - List all collections
  - `POST /api/collections` - Create new collection (admin only)
  - `GET /api/collections/{name}` - Get collection details
  - `PUT /api/collections/{name}` - Update collection (admin only)
  - `DELETE /api/collections/{name}` - Delete collection (admin only)
  - `GET /api/collections/{name}/records` - List records
  - `POST /api/collections/{name}/records` - Create record
  - `GET /api/collections/{name}/records/{id}` - Get record
  - `PUT /api/collections/{name}/records/{id}` - Update record
  - `DELETE /api/collections/{name}/records/{id}` - Delete record
- [x] **Comprehensive Testing** - 14/14 tests passing (unit + integration)

### 📊 **Technical Stack**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Rust + Tokio | High-performance async runtime |
| **Web Framework** | Axum | Modern, fast HTTP server |
| **Database** | SQLite + Diesel | Embedded database with type-safe ORM |
| **Authentication** | JWT + Argon2 | Secure token-based auth |
| **Serialization** | Serde | JSON handling |
| **Logging** | tracing | Structured observability |

### 🔧 **Getting Started**

#### Prerequisites
- Rust 1.70+ 
- SQLite
- Diesel CLI: `cargo install diesel_cli --no-default-features --features sqlite`

#### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ironbase

# Set up the database
diesel migration run

# Run the server
cargo run
```

#### Configuration

Set environment variables or use defaults:

```bash
export DATABASE_URL="db.sqlite"          # Database file path
export SERVER_HOST="127.0.0.1"           # Server bind address  
export SERVER_PORT="3000"                # Server port
export JWT_SECRET="your-secret-key"       # JWT signing secret
```

#### API Usage Examples

**Authentication Examples:**

**Register a new user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "username": "username"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com", 
    "password": "SecurePass123!"
  }'
```

**Access protected endpoint:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Collections API Examples:**

**Create a collection (admin only):**
```bash
curl -X POST http://localhost:3000/api/collections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "articles",
    "display_name": "Blog Articles",
    "description": "Collection for blog posts",
    "schema": {
      "fields": [
        {
          "name": "title",
          "field_type": "text",
          "required": true,
          "validation": {
            "max_length": 100
          }
        },
        {
          "name": "content",
          "field_type": "text",
          "required": false
        },
        {
          "name": "published",
          "field_type": "boolean",
          "required": false,
          "default_value": false
        },
        {
          "name": "views",
          "field_type": "number",
          "required": false,
          "default_value": 0
        }
      ]
    }
  }'
```

**Create a record:**
```bash
curl -X POST http://localhost:3000/api/collections/articles/records \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "My First Article",
      "content": "This is the content of my first article.",
      "published": true,
      "views": 42
    }
  }'
```

**Get all collections:**
```bash
curl -X GET http://localhost:3000/api/collections
```

**Get records with pagination:**
```bash
curl -X GET "http://localhost:3000/api/collections/articles/records?limit=10&offset=0"
```

**Update a record:**
```bash
curl -X PUT http://localhost:3000/api/collections/articles/records/1 \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "Updated Title",
      "views": 100
    }
  }'
```

## 🎯 **Roadmap & TODOs**

### 🔄 **Phase 4: Real-time & Files** (Next)
- [ ] **Real-time Subscriptions** - WebSocket-based live data updates
- [ ] **File Management** - Upload, storage, and serving of files
- [ ] **Advanced Queries** - Complex filtering with operators (gt, lt, contains, etc.)
- [ ] **Bulk Operations** - Batch create/update/delete operations
- [ ] **Data Import/Export** - CSV/JSON data migration tools

### 🎨 **Phase 5: Admin Dashboard**
- [ ] **Web Interface** - React-based administration panel
- [ ] **User Management** - Admin interface for user operations
- [ ] **Collection Builder** - Visual collection schema designer
- [ ] **Analytics Dashboard** - Usage statistics and monitoring
- [ ] **Settings Management** - Configuration via web interface
- [ ] **Backup & Restore** - Data management tools

### 📚 **Phase 6: SDK & Documentation**
- [ ] **JavaScript SDK** - Client library for web applications
- [ ] **TypeScript Definitions** - Full type safety for TS projects
- [ ] **API Documentation** - Interactive OpenAPI/Swagger docs
- [ ] **Integration Guides** - Framework-specific tutorials
- [ ] **Examples Repository** - Sample applications and use cases

### ⚡ **Phase 7: Performance & Production**
- [ ] **Horizontal Scaling** - Multi-instance deployment support
- [ ] **PostgreSQL Support** - Alternative to SQLite for larger deployments
- [ ] **Caching Layer** - Redis integration for performance
- [ ] **Monitoring & Metrics** - Prometheus/Grafana integration
- [ ] **Docker Support** - Containerization for easy deployment
- [ ] **Load Testing** - Performance benchmarks and optimization

### 🔒 **Future Security Enhancements**
- [ ] **OAuth2 Integration** - Social login providers
- [ ] **2FA Support** - Two-factor authentication
- [ ] **API Keys** - Service-to-service authentication
- [ ] **Role-based Permissions** - Fine-grained access control
- [ ] **Audit Logging** - Security event tracking
- [ ] **Session Management** - Advanced session controls

## 🏗️ **Architecture**

```
ironbase/
├── src/
│   ├── config/          # Application configuration
│   ├── database/        # Database connection and pooling
│   ├── handlers/        # HTTP request handlers
│   │   ├── auth.rs      # Authentication endpoints
│   │   ├── collections.rs # Collections API endpoints
│   │   └── health.rs    # Health check endpoint
│   ├── middleware/      # HTTP middleware
│   │   └── auth.rs      # Authentication & rate limiting
│   ├── models/          # Database models and DTOs
│   │   ├── user.rs      # User model with validation
│   │   └── collection.rs # Collection & record models
│   ├── services/        # Business logic layer
│   │   └── collection_service.rs # Collections operations
│   ├── utils/           # Shared utilities
│   │   ├── auth_error.rs # Error handling
│   │   └── jwt_service.rs # JWT token management
│   ├── schema.rs        # Diesel database schema
│   └── main.rs          # Application entry point
├── migrations/          # Database migrations
└── Cargo.toml          # Dependencies and metadata
```

### 🗄️ **Dynamic Collections Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                IRONBASE COLLECTIONS SYSTEM                 │
├─────────────────────────────────────────────────────────────┤
│ Collection: "articles"                                      │
│ SQL Table: records_articles                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ id | title | content | published | views | created_at  │ │
│ │ 1  | "..."  | "..."   | TRUE     | 42    | 2024-01-01 │ │
│ │ 2  | "..."  | "..."   | FALSE    | 156   | 2024-01-02 │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Collection: "products"                                      │
│ SQL Table: records_products                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ id | name | price | stock | category | created_at      │ │
│ │ 1  | "..." | 29.99 | 100   | "tech"  | 2024-01-01     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Metadata Table: collections                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ id | name      | schema_json | created_at              │ │
│ │ 1  | articles  | {...}       | 2024-01-01             │ │
│ │ 2  | products  | {...}       | 2024-01-01             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🛡️ **Security Features**

- **Password Security**: Argon2 hashing with secure salt generation
- **Token Management**: JWT with automatic rotation and expiration  
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request sanitization
- **Timing Attack Prevention**: Constant-time operations
- **Account Protection**: Automatic lockout after failed attempts
- **Secure Headers**: CORS and security middleware
- **Error Safety**: No sensitive data leakage in responses
- **SQL Injection Protection**: All dynamic queries properly escaped
- **Schema Validation**: Strict type checking and field validation
- **Access Control**: Admin-only collection management, public read access

## 🧪 **Testing**

```bash
# Run all tests (unit + integration)
cargo test -- --test-threads=1

# Run only unit tests
cargo test --lib

# Run only integration tests
cargo test --test collections_integration_tests

# Check code formatting
cargo fmt --check

# Run linter
cargo clippy
```

### 📊 **Test Coverage**

- **Unit Tests**: 4/4 passing (Collection service business logic)
- **Integration Tests**: 10/10 passing (Full HTTP API testing)
- **Total Coverage**: 14/14 tests passing
- **Test Categories**:
  - Authentication flow
  - Collection CRUD operations
  - Record CRUD operations
  - Schema validation
  - Error handling
  - Security (unauthorized access)
  - Data type validation

## 📈 **Performance**

IronBase is built for performance:
- **Rust's Zero-Cost Abstractions** - Maximum efficiency
- **Async/Await** - Non-blocking I/O for high concurrency
- **Connection Pooling** - Efficient database access
- **Minimal Dependencies** - Fast compilation and small binary size

## 🤝 **Contributing**

We welcome contributions! Please see our contributing guidelines for details on:
- Code style and standards
- Testing requirements  
- Pull request process
- Issue reporting

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🌟 **Why IronBase?**

- **🚀 Performance**: Built with Rust for maximum speed and efficiency
- **🔒 Security**: Production-grade security features built-in
- **🛠️ Developer Experience**: Simple API with powerful features
- **📈 Scalable**: Designed to grow with your application
- **🔧 Flexible**: Modular architecture for easy customization
- **🎯 Production Ready**: Battle-tested components and patterns

---

**Built with ❤️ and ⚡ by the IronBase team** 