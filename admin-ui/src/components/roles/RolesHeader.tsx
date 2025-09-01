import { MagnifyingGlassIcon, ShieldPlusIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RolesHeaderProps {
	rolesCount: number;
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onCreateRole: () => void;
}

export function RolesHeader({
	rolesCount,
	searchTerm,
	onSearchChange,
	onCreateRole,
}: RolesHeaderProps) {
	return (
		<div className="roles-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							Roles
						</h1>
						<Badge
							size="sm"
							variant="secondary"
							className="px-2 py-0.5 text-xs font-light"
						>
							{rolesCount} total
						</Badge>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-md">
						<Input
							placeholder="Search roles..."
							leftIcon={
								<span className="w-4 h-4 text-nocta-400 dark:text-nocta-500">
									<MagnifyingGlassIcon size={16} />
								</span>
							}
							value={searchTerm}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-10 w-full md:w-auto !bg-nocta-900"
						/>
					</div>
					<Button onClick={onCreateRole} className="w-full sm:w-auto">
						<ShieldPlusIcon size={16} />
						<span className="ml-2 whitespace-nowrap">Create Role</span>
					</Button>
				</div>
			</div>
		</div>
	);
}