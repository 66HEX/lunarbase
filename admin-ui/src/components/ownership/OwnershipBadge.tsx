import { Badge } from "@/components/ui/badge";
import { User, Users, Crown, UserCheck } from "lucide-react";
import type { OwnershipInfo } from "@/types/api";

interface OwnershipBadgeProps {
	ownership?: OwnershipInfo;
	currentUserId?: number;
	variant?: "default" | "secondary" | "destructive" | "outline";
	size?: "sm" | "default" | "lg";
	showIcon?: boolean;
}

export function OwnershipBadge({
	ownership,
	currentUserId,
	variant = "secondary",
	size = "default",
	showIcon = true,
}: OwnershipBadgeProps) {
	if (!ownership) {
		return (
			<Badge variant="outline" className="text-gray-500">
				{showIcon && <Users className="w-3 h-3 mr-1" />}
				No Owner
			</Badge>
		);
	}

	// Check if current user is the owner
	const isCurrentUserOwner = 
		currentUserId && (
			ownership.owner_id === currentUserId ||
			ownership.user_id === currentUserId ||
			ownership.created_by === currentUserId ||
			ownership.author_id === currentUserId
		);

	// Determine ownership type and display
	let ownershipType = "Unknown";
	let icon = <User className="w-3 h-3 mr-1" />;
	let badgeVariant = variant;

	if (ownership.owner_id) {
		ownershipType = isCurrentUserOwner ? "You (Owner)" : `Owner: ${ownership.owner_id}`;
		icon = <Crown className="w-3 h-3 mr-1" />;
		badgeVariant = isCurrentUserOwner ? "default" : "secondary";
	} else if (ownership.author_id) {
		ownershipType = isCurrentUserOwner ? "You (Author)" : `Author: ${ownership.author_id}`;
		icon = <UserCheck className="w-3 h-3 mr-1" />;
		badgeVariant = isCurrentUserOwner ? "default" : "secondary";
	} else if (ownership.created_by) {
		ownershipType = isCurrentUserOwner ? "You (Creator)" : `Creator: ${ownership.created_by}`;
		icon = <User className="w-3 h-3 mr-1" />;
		badgeVariant = isCurrentUserOwner ? "default" : "secondary";
	} else if (ownership.user_id) {
		ownershipType = isCurrentUserOwner ? "You" : `User: ${ownership.user_id}`;
		icon = <User className="w-3 h-3 mr-1" />;
		badgeVariant = isCurrentUserOwner ? "default" : "secondary";
	}

	return (
		<Badge 
			variant={badgeVariant} 
			className={`
				${size === "sm" ? "text-xs px-2 py-0.5" : ""}
				${size === "lg" ? "text-sm px-3 py-1" : ""}
				${isCurrentUserOwner ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}
			`}
		>
			{showIcon && icon}
			{ownershipType}
		</Badge>
	);
}