import { Plus, Search } from "lucide-react";
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
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-nocta-900 dark:text-nocta-100">
							Collections
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							{collectionsCount} total
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Manage your data collections and schemas
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-md">
						<Input
							placeholder="Search collections..."
							leftIcon={
								<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
							}
							value={searchTerm}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-10 w-full md:w-auto"
						/>
					</div>
					<Button onClick={onCreateCollection} className="w-full sm:w-auto">
						<Plus className="w-4 h-4 mr-2" />
						<span className="whitespace-nowrap">Create Collection</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
