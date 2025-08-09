import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface RecordsHeaderProps {
	totalRecords: number;
	searchTerm: string;
	onSearchChange: (value: string) => void;
}

export function RecordsHeader({
	totalRecords,
	searchTerm,
	onSearchChange,
}: RecordsHeaderProps) {
	return (
		<div className="records-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-nocta-900 dark:text-nocta-100">
							All Records
						</h1>
						<Badge variant="secondary" className="">
							{totalRecords} records
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Browse and manage all records across collections
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
				</div>
			</div>
		</div>
	);
}
