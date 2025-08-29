import { PlusIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CollectionsHeaderProps {
	collectionsCount: number;
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onCreateCollection: () => void;
}

export function CollectionsHeader({
	collectionsCount,
	searchTerm,
	onSearchChange,
	onCreateCollection,
}: CollectionsHeaderProps) {
	return (
		<div className="collections-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							Collections
						</h1>
						<Badge
							size="sm"
							variant="secondary"
							className="text-xs font-light"
						>
							{collectionsCount} total
						</Badge>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-md">
						<Input
							placeholder="Search collections..."
							leftIcon={
								<MagnifyingGlassIcon size={16} />
							}
							value={searchTerm}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-10 w-full md:w-auto !bg-nocta-900"
						/>
					</div>
					<Button onClick={onCreateCollection} className="w-full sm:w-auto">
						<PlusIcon size={16} />
						<span className="whitespace-nowrap ml-2">Create Collection</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
