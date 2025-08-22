# LunarBase Permissions System

## Permission Hierarchy

The permission system follows a strict hierarchy from highest to lowest priority:

### 1. Administrator Role (Highest Priority)

**Complete System Access**
- Administrators have unrestricted access to all operations across the entire system
- This permission level bypasses all other permission checks
- Cannot be overridden by any other permission type
- Provides full CRUD operations on all collections and records

### 2. Record Ownership (Second Priority)

**Automatic Owner Rights**
- Users automatically receive specific permissions for records they own
- Ownership is determined by `owner_id` or `author_id` fields in records
- Owners automatically receive:
  - **Read** access to their records
  - **Update** access to their records  
  - **Delete** access to their records
- Ownership permissions override user-specific and role-based permissions for owned records
- Does not apply to Create and List operations (these remain collection-level)

**Ownership Assignment**
- Ownership is automatically assigned when creating records
- Both `author_id` and `owner_id` fields are set to the creator's user ID
- Ownership can be transferred between users through dedicated endpoints

### 3. Record-Specific Permissions (Third Priority)

**Granular Record Control**
- Permissions can be set for specific records and specific users
- Allows fine-grained control over individual record access
- Available permissions: Read, Update, Delete
- Overrides collection-level permissions for the specified record
- Does not include Create or List permissions (collection-level only)

### 4. User-Specific Collection Permissions (Fourth Priority)

**Individual User Overrides**
- Allows setting custom permissions for individual users on specific collections
- Uses an override system where explicit settings take precedence
- Permissions can be:
  - **Explicitly granted** (overrides role permissions)
  - **Explicitly denied** (overrides role permissions)
  - **Inherited** (falls back to role permissions)
- Covers all five permission types: Create, Read, Update, Delete, List
- Overrides role-based permissions when explicitly set

### 5. Role-Based Collection Permissions (Fifth Priority)

**Group-Level Access Control**
- Permissions are assigned to roles, and users inherit permissions from their assigned role
- Roles have priority levels - higher priority roles can have more extensive permissions
- Provides the baseline permissions for users
- Covers all five permission types: Create, Read, Update, Delete, List
- Serves as the default permission set when no higher-priority permissions apply

### 6. Default (No Access) - Lowest Priority

**Secure by Default**
- When no permissions are explicitly granted, access is denied
- Ensures the system is secure by default
- Users must be explicitly granted permissions to access resources

## Permission Types

### Collection-Level Operations
- **Create**: Add new records to a collection
- **Read**: View individual records in a collection
- **Update**: Modify existing records in a collection
- **Delete**: Remove records from a collection
- **List**: View lists of records in a collection

### Record-Level Operations
- **Read**: View a specific record
- **Update**: Modify a specific record
- **Delete**: Remove a specific record

*Note: Create and List operations are not available at the record level as they are inherently collection-level operations.*

## Permission Resolution Process

When a user attempts to perform an operation, the system checks permissions in the following order:

1. **Admin Check**: If the user is an administrator, grant access immediately
2. **Ownership Check**: If the operation is on a record owned by the user, check ownership permissions
3. **Record-Specific Check**: Look for explicit record-level permissions for this user
4. **User-Specific Check**: Check for user-specific collection permissions
5. **Role-Based Check**: Fall back to the user's role permissions
6. **Default Deny**: If no permissions are found, deny access