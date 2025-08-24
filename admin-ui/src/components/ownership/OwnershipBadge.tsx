import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

	const isCurrentUserOwner = ownership.owner_id === currentUserId;

	let ownershipType = "Unknown";
	let badgeVariant = variant;

	if (ownership.owner_id) {
		ownershipType = isCurrentUserOwner
			? "You (Owner)"
			: `Owner ID: ${ownership.owner_id}`;
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
			{ownershipType}
		</Badge>
	);
}
