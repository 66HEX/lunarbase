# Ownership Functionality Implementation Plan

## Overview

This document outlines the detailed implementation plan for adding ownership functionality to the Lunarbase admin UI. The backend already has complete ownership implementation, so this plan focuses on frontend integration and UI enhancements.

## Backend Analysis (Already Implemented)

### Existing Backend Features

#### Ownership Service (`src/services/ownership_service.rs`)
- **OwnershipService**: Main service class managing ownership operations
- **Ownership Patterns**: Supports multiple ownership fields (user_id, created_by, owner_id, author_id, email, username)
- **Automatic Assignment**: Sets ownership when creating records
- **Ownership Transfer**: Allows transferring ownership between users
- **Ownership Queries**: Retrieves records owned by specific users
- **Permission Integration**: Provides ownership-based permissions

#### API Endpoints (`src/handlers/ownership.rs`)
- `POST /collections/{collection}/records/{id}/ownership/transfer` - Transfer ownership
- `GET /collections/{collection}/ownership/my-records` - Get current user's records
- `GET /collections/{collection}/ownership/users/{user_id}/records` - Get user's records (admin only)
- `GET /collections/{collection}/records/{id}/ownership` - Check ownership status
- `GET /collections/{collection}/ownership/stats` - Get ownership statistics

## Frontend Implementation Plan

### Phase 1: Foundation (High Priority)

#### 1.1 Type Definitions
**File**: `admin-ui/src/types/api.ts`

```typescript
// Add to existing types
export interface OwnershipInfo {
  is_owner: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  owner_id?: number;
  owner_username?: string;
  owner_email?: string;
}

export interface TransferOwnershipRequest {
  new_owner_id: number;
}

export interface OwnershipStats {
  collection_name: string;
  collection_id: number;
  total_records: number;
  owned_records: number;
  unowned_records: number;
  ownership_percentage: number;
  timestamp: string;
}

export interface OwnedRecordsResponse {
  collection_name: string;
  user_id: number;
  username?: string;
  total_owned: number;
  records: ApiRecord[];
}

// Extend existing Record type
export interface RecordWithOwnership extends ApiRecord {
  ownership?: OwnershipInfo;
}
```

#### 1.2 API Client Extension
**File**: `admin-ui/src/lib/api.ts`

```typescript
// Add new ownership API section
export const ownershipApi = {
  // Check ownership status for a specific record
  checkOwnership: async (
    collectionName: string, 
    recordId: number
  ): Promise<OwnershipInfo> => {
    const response = await apiRequest<ApiResponse<OwnershipInfo>>(
      `/collections/${collectionName}/records/${recordId}/ownership`
    );
    return response.data;
  },

  // Transfer ownership to another user
  transferOwnership: async (
    collectionName: string,
    recordId: number,
    newOwnerId: number
  ): Promise<void> => {
    await apiRequest<void>(
      `/collections/${collectionName}/records/${recordId}/ownership/transfer`,
      {
        method: 'POST',
        body: JSON.stringify({ new_owner_id: newOwnerId })
      }
    );
  },

  // Get current user's owned records
  getMyOwnedRecords: async (
    collectionName: string,
    limit?: number,
    offset?: number
  ): Promise<OwnedRecordsResponse> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const url = `/collections/${collectionName}/ownership/my-records${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    
    const response = await apiRequest<ApiResponse<OwnedRecordsResponse>>(url);
    return response.data;
  },

  // Get ownership statistics (admin only)
  getOwnershipStats: async (collectionName: string): Promise<OwnershipStats> => {
    const response = await apiRequest<ApiResponse<OwnershipStats>>(
      `/collections/${collectionName}/ownership/stats`
    );
    return response.data;
  },

  // Get user's owned records (admin only)
  getUserOwnedRecords: async (
    collectionName: string,
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<OwnedRecordsResponse> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const url = `/collections/${collectionName}/ownership/users/${userId}/records${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    
    const response = await apiRequest<ApiResponse<OwnedRecordsResponse>>(url);
    return response.data;
  }
};
```

### Phase 2: Core Components (High Priority)

#### 2.1 Ownership Badge Component
**File**: `admin-ui/src/components/ownership/OwnershipBadge.tsx`

```typescript
import { Crown, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { OwnershipInfo } from "@/types/api";

interface OwnershipBadgeProps {
  ownership?: OwnershipInfo;
  currentUserId?: number;
  showTooltip?: boolean;
}

export function OwnershipBadge({ 
  ownership, 
  currentUserId, 
  showTooltip = true 
}: OwnershipBadgeProps) {
  if (!ownership) {
    return (
      <Badge variant="outline" className="text-gray-500">
        <User className="w-3 h-3 mr-1" />
        No Owner
      </Badge>
    );
  }

  const isCurrentUser = ownership.owner_id === currentUserId;
  const badgeContent = (
    <Badge 
      variant={isCurrentUser ? "default" : "secondary"}
      className={isCurrentUser ? "bg-blue-100 text-blue-800" : ""}
    >
      {isCurrentUser ? (
        <Crown className="w-3 h-3 mr-1" />
      ) : (
        <User className="w-3 h-3 mr-1" />
      )}
      {isCurrentUser ? "You" : (ownership.owner_username || "Unknown")}
    </Badge>
  );

  if (!showTooltip) return badgeContent;

  return (
    <Tooltip content={
      <div className="text-sm">
        <div className="font-medium">
          {isCurrentUser ? "You own this record" : `Owned by ${ownership.owner_username}`}
        </div>
        <div className="text-gray-500 mt-1">
          Permissions: {ownership.can_read ? "Read" : ""} 
          {ownership.can_update ? ", Update" : ""}
          {ownership.can_delete ? ", Delete" : ""}
        </div>
      </div>
    }>
      {badgeContent}
    </Tooltip>
  );
}
```

#### 2.2 Transfer Ownership Dialog
**File**: `admin-ui/src/components/ownership/TransferOwnershipDialog.tsx`

```typescript
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ownershipApi, usersApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import type { User } from "@/types/api";

interface TransferOwnershipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  recordId: number;
  currentOwner?: string;
}

export function TransferOwnershipDialog({
  isOpen,
  onClose,
  collectionName,
  recordId,
  currentOwner
}: TransferOwnershipDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: (newOwnerId: number) => 
      ownershipApi.transferOwnership(collectionName, recordId, newOwnerId),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Ownership transferred successfully",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["collectionRecords"] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to transfer ownership",
        variant: "destructive"
      });
    }
  });

  // Search users implementation would go here
  // ...

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content className="max-w-md">
        <Dialog.Header>
          <Dialog.Title className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Transfer Ownership
          </Dialog.Title>
          <Dialog.Description>
            Transfer ownership of this record from {currentOwner} to another user.
          </Dialog.Description>
        </Dialog.Header>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* User selection list */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedUser?.id === user.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="font-medium">{user.username || user.email}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
            ))}
          </div>
        </div>
        
        <Dialog.Footer>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedUser && transferMutation.mutate(selectedUser.id)}
            disabled={!selectedUser || transferMutation.isPending}
          >
            {transferMutation.isPending ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

### Phase 3: Table Integration (High Priority)

#### 3.1 Enhanced Records Table
**File**: `admin-ui/src/components/records/RecordsTable.tsx` (modifications)

```typescript
// Add ownership column to the table header
<TableHeader>
  <TableRow>
    <TableCell header className="w-16">ID</TableCell>
    <TableCell header className="w-32">Collection</TableCell>
    <TableCell header>Data</TableCell>
    <TableCell header className="w-32">Owner</TableCell> {/* NEW */}
    <TableCell header className="w-32">Created</TableCell>
    <TableCell header className="w-24">Actions</TableCell>
  </TableRow>
</TableHeader>

// Add ownership cell in the table body
<TableCell>
  <OwnershipBadge 
    ownership={record.ownership}
    currentUserId={currentUser?.id}
  />
</TableCell>
```

#### 3.2 Enhanced Collection Records Page
**File**: `admin-ui/src/routes/records/$collection.tsx` (modifications)

Add ownership-related state and functions:

```typescript
// Add state for ownership filtering
const [showOnlyMyRecords, setShowOnlyMyRecords] = useState(false);
const [transferDialogOpen, setTransferDialogOpen] = useState(false);
const [recordToTransfer, setRecordToTransfer] = useState<Record | null>(null);

// Add ownership hooks
const { data: currentUser } = useQuery({
  queryKey: ['currentUser'],
  queryFn: () => authApi.me()
});

// Modify records query to include ownership filtering
const {
  data: recordsData,
  isLoading,
  error,
  refetch,
} = useCollectionRecordsQuery({
  collectionName: collectionName || "",
  currentPage,
  pageSize,
  searchTerm: debouncedSearchTerm,
  showOnlyMyRecords, // NEW FILTER
});
```

### Phase 4: Advanced Features (Medium Priority)

#### 4.1 Ownership Filter Component
**File**: `admin-ui/src/components/ownership/OwnershipFilter.tsx`

```typescript
import { Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface OwnershipFilterProps {
  showOnlyMyRecords: boolean;
  onToggle: (value: boolean) => void;
  myRecordsCount?: number;
}

export function OwnershipFilter({ 
  showOnlyMyRecords, 
  onToggle, 
  myRecordsCount 
}: OwnershipFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="ownership-filter"
        checked={showOnlyMyRecords}
        onCheckedChange={onToggle}
      />
      <Label htmlFor="ownership-filter" className="flex items-center gap-2">
        <Crown className="w-4 h-4" />
        Show only my records
        {myRecordsCount !== undefined && (
          <span className="text-sm text-gray-500">({myRecordsCount})</span>
        )}
      </Label>
    </div>
  );
}
```

#### 4.2 Ownership Statistics Card
**File**: `admin-ui/src/components/ownership/OwnershipStatsCard.tsx`

```typescript
import { Crown, Users, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { OwnershipStats } from "@/types/api";

interface OwnershipStatsCardProps {
  stats: OwnershipStats;
  isLoading?: boolean;
}

export function OwnershipStatsCard({ stats, isLoading }: OwnershipStatsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Ownership Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5" />
          Ownership Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.owned_records}
            </div>
            <div className="text-sm text-gray-500">Owned Records</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {stats.unowned_records}
            </div>
            <div className="text-sm text-gray-500">Unowned Records</div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Ownership Coverage</span>
            <span>{stats.ownership_percentage.toFixed(1)}%</span>
          </div>
          <Progress value={stats.ownership_percentage} className="h-2" />
        </div>
        
        <div className="text-xs text-gray-500 text-center">
          Total: {stats.total_records} records
        </div>
      </CardContent>
    </Card>
  );
}
```

### Phase 5: Hooks and State Management (Medium Priority)

#### 5.1 Ownership Hooks
**File**: `admin-ui/src/hooks/ownership/useOwnership.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownershipApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export const useOwnership = (collectionName: string, recordId: number) => {
  return useQuery({
    queryKey: ['ownership', collectionName, recordId],
    queryFn: () => ownershipApi.checkOwnership(collectionName, recordId),
    enabled: !!collectionName && !!recordId
  });
};

export const useMyOwnedRecords = (
  collectionName: string, 
  limit?: number, 
  offset?: number
) => {
  return useQuery({
    queryKey: ['myOwnedRecords', collectionName, limit, offset],
    queryFn: () => ownershipApi.getMyOwnedRecords(collectionName, limit, offset),
    enabled: !!collectionName
  });
};

export const useOwnershipStats = (collectionName: string) => {
  return useQuery({
    queryKey: ['ownershipStats', collectionName],
    queryFn: () => ownershipApi.getOwnershipStats(collectionName),
    enabled: !!collectionName
  });
};

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ 
      collectionName, 
      recordId, 
      newOwnerId 
    }: { 
      collectionName: string; 
      recordId: number; 
      newOwnerId: number; 
    }) => ownershipApi.transferOwnership(collectionName, recordId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectionRecords'] });
      queryClient.invalidateQueries({ queryKey: ['ownership'] });
      queryClient.invalidateQueries({ queryKey: ['ownershipStats'] });
      toast({
        title: "Success",
        description: "Ownership transferred successfully",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to transfer ownership",
        variant: "destructive"
      });
    }
  });
};
```

### Phase 6: Dashboard Integration (Low Priority)

#### 6.1 Dashboard Ownership Overview
**File**: `admin-ui/src/components/dashboard/OwnershipOverviewCard.tsx`

```typescript
import { Crown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { collectionsApi, ownershipApi } from "@/lib/api";

export function OwnershipOverviewCard() {
  const navigate = useNavigate();
  
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.list()
  });

  // Aggregate ownership stats across all collections
  const ownershipQueries = useQueries({
    queries: (collections?.data || []).map(collection => ({
      queryKey: ['ownershipStats', collection.name],
      queryFn: () => ownershipApi.getOwnershipStats(collection.name)
    }))
  });

  const totalStats = ownershipQueries.reduce(
    (acc, query) => {
      if (query.data) {
        acc.totalRecords += query.data.total_records;
        acc.ownedRecords += query.data.owned_records;
      }
      return acc;
    },
    { totalRecords: 0, ownedRecords: 0 }
  );

  const ownershipPercentage = totalStats.totalRecords > 0 
    ? (totalStats.ownedRecords / totalStats.totalRecords) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Crown className="w-4 h-4" />
          Ownership Overview
        </CardTitle>
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {ownershipPercentage.toFixed(1)}%
        </div>
        <p className="text-xs text-muted-foreground">
          {totalStats.ownedRecords} of {totalStats.totalRecords} records have owners
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3 w-full"
          onClick={() => navigate({ to: '/records' })}
        >
          View My Records
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Add ownership types to `types/api.ts`
- [ ] Extend API client with ownership endpoints
- [ ] Create basic ownership hooks
- [ ] Test API integration

### Week 2: Core Components
- [ ] Implement `OwnershipBadge` component
- [ ] Create `TransferOwnershipDialog` component
- [ ] Add ownership column to `RecordsTable`
- [ ] Test component integration

### Week 3: Table Integration
- [ ] Modify collection records page
- [ ] Add ownership filtering
- [ ] Implement "My Records" filter
- [ ] Add transfer ownership functionality

### Week 4: Advanced Features
- [ ] Create ownership statistics components
- [ ] Add dashboard integration
- [ ] Implement admin ownership management
- [ ] Performance optimization

### Week 5: Polish & Testing
- [ ] UI/UX improvements
- [ ] Error handling enhancement
- [ ] Integration testing
- [ ] Documentation updates

## Testing Strategy

### Unit Tests
- Test ownership hooks with mock data
- Test component rendering with different ownership states
- Test API client methods

### Integration Tests
- Test ownership transfer workflow
- Test filtering functionality
- Test permission-based UI changes

### E2E Tests
- Test complete ownership transfer process
- Test "My Records" filtering
- Test admin ownership management

## Performance Considerations

1. **Lazy Loading**: Load ownership information only when needed
2. **Caching**: Use React Query caching for ownership data
3. **Batch Requests**: Batch ownership checks for multiple records
4. **Optimistic Updates**: Use optimistic updates for ownership transfers

## Security Considerations

1. **Permission Checks**: Verify ownership permissions on frontend
2. **Input Validation**: Validate user selection in transfer dialog
3. **Error Handling**: Graceful handling of unauthorized actions
4. **Audit Trail**: Log ownership changes for security

## Accessibility

1. **Screen Readers**: Proper ARIA labels for ownership indicators
2. **Keyboard Navigation**: Full keyboard support for ownership actions
3. **Color Contrast**: Ensure ownership badges meet contrast requirements
4. **Focus Management**: Proper focus handling in dialogs

## Future Enhancements

1. **Bulk Ownership Transfer**: Transfer ownership of multiple records
2. **Ownership Templates**: Predefined ownership rules for collections
3. **Ownership History**: Track ownership changes over time
4. **Advanced Filtering**: Filter by owner, ownership date, etc.
5. **Ownership Notifications**: Notify users of ownership changes

---

*This implementation plan provides a comprehensive roadmap for adding ownership functionality to the Lunarbase admin UI. The backend is already complete, so focus should be on creating an intuitive and efficient frontend experience.*