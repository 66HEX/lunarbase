import { Link } from "@tanstack/react-router";
import { Database, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyRecordsStateProps {
	searchTerm: string;
}

export function EmptyRecordsState({ searchTerm }: EmptyRecordsStateProps) {
	return (
		<Card>
			<CardContent className="py-12">
				<div className="text-center">
					<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
						<Database className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
					</div>
					<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
						{searchTerm ? "No records found" : "No records yet"}
					</h3>
					<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
						{searchTerm
							? `No records match "${searchTerm}". Try a different search term.`
							: "Create your first collection and add records to get started."}
					</p>
					{!searchTerm && (
						<Link to="/collections">
							<Button>
								<FileText className="w-4 h-4 mr-2" />
								Create Collection
							</Button>
						</Link>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
