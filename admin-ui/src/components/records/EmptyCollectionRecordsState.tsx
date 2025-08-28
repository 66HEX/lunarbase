import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyCollectionRecordsStateProps {
	searchTerm: string;
	collectionName: string;
	onAddRecord: () => void;
}

export function EmptyCollectionRecordsState({
	searchTerm,
	collectionName,
	onAddRecord,
}: EmptyCollectionRecordsStateProps) {
	return (
		<Card>
			<CardContent className="py-12">
				<div className="text-center">
					<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800 w-fit mx-auto mb-4 shadow-sm">
						<FileText className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
					</div>
					<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
						{searchTerm ? "No records found" : "No records yet"}
					</h3>
					<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
						{searchTerm
							? `No records match "${searchTerm}". Try a different search term.`
							: `Start by adding your first record to the ${collectionName} collection.`}
					</p>
					{!searchTerm && (
						<Button onClick={onAddRecord}>
							<Plus className="w-4 h-4 mr-2" />
							Add Record
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
