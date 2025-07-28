import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Database, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CollectionStats } from "@/types/api";

interface CollectionsOverviewCardProps {
	collections: CollectionStats | null | undefined;
}

export function CollectionsOverviewCard({
	collections,
}: CollectionsOverviewCardProps) {
	const hasCollections =
		collections?.records_per_collection &&
		Object.keys(collections.records_per_collection).length > 0;

	return (
		<Card className="dashboard-card min-h-96">
			<CardHeader className="pb-4 p-4">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<div className="p-1.5 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
							<Database className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
						</div>
						Collections Overview
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{hasCollections ? (
					<div className="space-y-3">
						{Object.entries(collections.records_per_collection)
							.slice(0, 4)
							.map(([name, count]) => (
								<div
									key={name}
									className="p-4 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg transition-all duration-200 group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="w-2 h-2 rounded-full bg-nocta-400 dark:bg-nocta-500"></div>
											<span className="font-semibold text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
												{name}
											</span>
										</div>
										<div className="flex items-center gap-3">
											<Badge
												variant="secondary"
												className="px-2 py-0.5 text-xs font-medium"
											>
												{count} {count === 1 ? "record" : "records"}
											</Badge>
										</div>
									</div>
								</div>
							))}
						{collections?.records_per_collection &&
							Object.keys(collections.records_per_collection).length > 5 && (
								<div className="pt-3 border-t border-nocta-200 dark:border-nocta-800/50">
									<Link
										to="/collections"
										className="text-sm text-nocta-600 dark:text-nocta-400 hover:text-nocta-900 dark:hover:text-nocta-100 font-medium flex items-center gap-1 transition-colors duration-200 w-fit"
									>
										View{" "}
										{Object.keys(collections.records_per_collection).length - 5}{" "}
										more collections
										<ArrowUpRight className="w-3 h-3" />
									</Link>
								</div>
							)}
					</div>
				) : (
					<div className="text-center py-2">
						<div className="p-2 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-3">
							<Database className="w-6 h-6 text-nocta-400 dark:text-nocta-500" />
						</div>
						<h3 className="text-base font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
							No collections yet
						</h3>
						<p className="text-sm text-nocta-600 dark:text-nocta-400 mb-3 max-w-sm mx-auto">
							Get started by creating your first data collection to organize
							your records.
						</p>
						<Link to="/collections">
							<Button size="sm" className="px-3 py-1.5">
								<Plus className="w-4 h-4 mr-2" />
								Create Collection
							</Button>
						</Link>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
