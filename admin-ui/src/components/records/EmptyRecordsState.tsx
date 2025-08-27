import { Database, FileText } from "lucide-react";
import { CreateCollectionSheet } from "@/components/collections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientStore } from "@/stores/client.store";

interface EmptyRecordsStateProps {
	searchTerm: string;
}

export function EmptyRecordsState({ searchTerm }: EmptyRecordsStateProps) {
	const sheets = useClientStore((state) => state.ui.sheets);
	const openSheet = useClientStore((state) => state.openSheet);
	const closeSheet = useClientStore((state) => state.closeSheet);

	const handleCreateCollection = () => {
		openSheet("createCollection");
	};

	return (
		<>
			<Card>
				<CardContent className="py-12">
					<div className="text-center">
						<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
							<Database className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
						</div>
						<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
							{searchTerm ? "No records found" : "No records yet"}
						</h3>
						<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
							{searchTerm
								? `No records match "${searchTerm}". Try a different search term.`
								: "Create your first collection and add records to get started."}
						</p>
						{!searchTerm && (
							<Button onClick={handleCreateCollection}>
								<FileText className="w-4 h-4 mr-2" />
								Create Collection
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
			<CreateCollectionSheet
				isOpen={sheets.createCollection || false}
				onOpenChange={(open) =>
					open ? openSheet("createCollection") : closeSheet("createCollection")
				}
			/>
		</>
	);
}
