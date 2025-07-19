import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordsPaginationProps {
	currentPage: number;
	totalPages: number;
	totalRecords: number;
	pageSize: number;
	onPageChange: (page: number) => void;
}

export function RecordsPagination({
	currentPage,
	totalPages,
	totalRecords,
	pageSize,
	onPageChange,
}: RecordsPaginationProps) {
	if (totalPages <= 1) return null;

	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;

	return (
		<div className="flex items-center justify-between">
			<div className="text-sm text-nocta-600 dark:text-nocta-400">
				Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} of{" "}
				{totalRecords} records
			</div>
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 1}
				>
					<ChevronLeft className="w-4 h-4" />
				</Button>
				<span className="text-sm text-nocta-600 dark:text-nocta-400">
					Page {currentPage} of {totalPages}
				</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}
