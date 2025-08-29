import { MagnifyingGlassIcon } from "@phosphor-icons/react";
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
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							All Records
						</h1>
						<Badge size="sm" variant="secondary" className="">
							{totalRecords} records
						</Badge>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-md">
						<Input
							placeholder="Search records..."
							leftIcon={
								<span className="text-nocta-400 dark:text-nocta-500">
									<MagnifyingGlassIcon size={16} />
								</span>
							}
							value={searchTerm}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-10 w-full md:w-auto !bg-nocta-900"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
