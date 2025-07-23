import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PermissionsHeaderProps {
	rolesCount: number;
}

export function PermissionsHeader({ rolesCount }: PermissionsHeaderProps) {
	return (
		<div className="permissions-header">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							Permissions & Roles
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							<Shield className="w-3 h-3 mr-1" />
							{rolesCount} roles
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Manage user roles and system permissions
					</p>
				</div>
			</div>
		</div>
	);
}
