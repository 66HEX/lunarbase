import { Link } from "@tanstack/react-router";
import { Edit3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	TableBody,
	TableCell,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Record } from "@/types/api";

interface RecordWithCollection extends Record {
	collection_name: string;
}

interface RecordsTableProps {
	records: RecordWithCollection[];
	onEditRecord: (record: RecordWithCollection) => void;
	onDeleteRecord: (collectionName: string, recordId: number) => void;
}

export function RecordsTable({
	records,
	onEditRecord,
	onDeleteRecord,
}: RecordsTableProps) {
	const formatFieldValue = (value: unknown): string => {
		if (value === null || value === undefined) return "-";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	return (
		<Card>
			<CardContent className="p-0">
				<div className="overflow-x-auto">
					<table className="w-full">
						<TableHeader>
							<TableRow>
								<TableCell header className="w-16">
									ID
								</TableCell>
								<TableCell header className="w-32">
									Collection
								</TableCell>
								<TableCell header>Data</TableCell>
								<TableCell header className="w-32">
									Created
								</TableCell>
								<TableCell header className="w-24">
									Actions
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody>
							{records.map((record) => (
								<TableRow key={`${record.collection_name}-${record.id}`}>
									<TableCell className="font-medium">{record.id}</TableCell>
									<TableCell>
										<Link to={`/collections`}>
											<Badge
												size="sm"
												variant="secondary"
												className="cursor-pointer hover:bg-nocta-200 dark:hover:bg-nocta-700"
											>
												{record.collection_name}
											</Badge>
										</Link>
									</TableCell>
									<TableCell>
										<div className="flex gap-4">
											{Object.entries(record.data)
												.slice(1, 3)
												.map(([key, value]) => (
													<div key={key} className="text-sm">
														<span className="font-medium text-nocta-700 dark:text-nocta-300">
															{key}:
														</span>{" "}
														<span className="text-nocta-600 dark:text-nocta-400 truncate">
															{formatFieldValue(value)}
														</span>
													</div>
												))}
											{Object.keys(record.data).length > 3 && (
												<div className="text-xs text-nocta-500 dark:text-nocta-500 mt-1">
													+{Object.keys(record.data).length - 3} more fields
												</div>
											)}
										</div>
									</TableCell>
									<TableCell className="text-sm text-nocta-600 dark:text-nocta-400">
										{new Date(record.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="w-8 h-8 p-0"
												onClick={() => onEditRecord(record)}
											>
												<Edit3 className="w-4 h-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
												onClick={() =>
													onDeleteRecord(record.collection_name, record.id)
												}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
