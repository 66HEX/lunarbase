import { ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Collection, RecordData } from "@/types/api";
import { CreateRecordSheet } from "./CreateRecordSheet";

interface CollectionRecordsHeaderProps {
	collectionName: string;
	collection: Collection | null;
	totalCount: number;
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onNavigateBack: () => void;
	isSheetOpen: boolean;
	onSheetOpenChange: (open: boolean) => void;
	onCreateRecord: (data: RecordData) => Promise<void>;
}

export function CollectionRecordsHeader({
	collectionName,
	collection,
	totalCount,
	searchTerm,
	onSearchChange,
	onNavigateBack,
	isSheetOpen,
	onSheetOpenChange,
	onCreateRecord,
}: CollectionRecordsHeaderProps) {
	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div className="space-y-1">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						onClick={onNavigateBack}
						className="p-2 shrink-0"
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-nocta-900 dark:text-nocta-100 truncate">
						{collection?.display_name || collectionName}
					</h1>
					<Badge variant="secondary" className="">
						{totalCount} records
					</Badge>
				</div>
				<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
					{collection?.description ||
						`Manage records in the ${collectionName} collection`}
				</p>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="relative w-full sm:max-w-md">
					<Input
						placeholder="Search records..."
						leftIcon={
							<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
						}
						value={searchTerm}
						onChange={(e) => onSearchChange(e.target.value)}
						className="pl-10 w-full md:w-auto"
					/>
				</div>
				<div className="w-full sm:w-auto">
					<CreateRecordSheet
						open={isSheetOpen}
						onOpenChange={onSheetOpenChange}
						collection={collection}
						onSubmit={onCreateRecord}
					/>
				</div>
			</div>
		</div>
	);
}
