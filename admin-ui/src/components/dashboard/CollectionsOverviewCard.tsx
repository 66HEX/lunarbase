import {
	ArrowUpRightIcon,
	DatabaseIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollectionRecordCounts } from "@/hooks/collections/useCollections";
import type { CollectionStats } from "@/types/api";

interface CollectionsOverviewCardProps {
	collections: CollectionStats | null | undefined;
}

export function CollectionsOverviewCard({
	collections,
}: CollectionsOverviewCardProps) {
	const { data: recordCounts, isLoading: recordCountsLoading } = useCollectionRecordCounts();
	
	const hasCollections = recordCounts && recordCounts.records_per_collection && Object.keys(recordCounts.records_per_collection).length > 0;
	const hasCollectionsFromProps =
		collections?.records_per_collection &&
		Object.keys(collections.records_per_collection).length > 0;
	
	const shouldShowCollections = hasCollections || hasCollectionsFromProps;

	return (
		<Card className="dashboard-card md:min-h-64">
			<CardHeader className="pb-3 p-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<div className="p-1">
							<DatabaseIcon size={14} />
						</div>
						Collections Overview
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="p-3 pt-0">
				{shouldShowCollections ? (
				<div className="space-y-2">
					{recordCountsLoading ? (
						[...Array(3)].map((_, i) => (
							<div key={i} className="p-2.5 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg animate-pulse">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="w-2 h-2 rounded-full bg-nocta-300 dark:bg-nocta-600"></div>
										<div className="h-4 w-20 bg-nocta-300 dark:bg-nocta-600 rounded"></div>
									</div>
									<div className="h-5 w-16 bg-nocta-300 dark:bg-nocta-600 rounded"></div>
								</div>
							</div>
						))
					) : hasCollections ? (
						Object.entries(recordCounts.records_per_collection)
							.sort(([, a], [, b]) => b - a)
							.slice(0, 3)
							.map(([collectionName, count]) => (
								<div
									key={collectionName}
									className="p-2.5 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg transition-all duration-200 group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2.5">
											<div className="w-2 h-2 rounded-full bg-nocta-400 dark:bg-nocta-500"></div>
											<span className="font-light text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
												{collectionName}
											</span>
										</div>
										<div className="flex items-center gap-2.5">
											<Badge
												variant="secondary"
												className="px-2 py-0.5 text-xs font-light"
											>
												{count} {count === 1 ? "record" : "records"}
											</Badge>
										</div>
									</div>
								</div>
							))
					) : hasCollectionsFromProps ? (
						Object.entries(collections.records_per_collection)
							.slice(0, 3)
							.map(([name, count]) => (
								<div
									key={name}
									className="p-2.5 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg transition-all duration-200 group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2.5">
											<div className="w-2 h-2 rounded-full bg-nocta-400 dark:bg-nocta-500"></div>
											<span className="font-light text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
												{name}
											</span>
										</div>
										<div className="flex items-center gap-2.5">
											<Badge
												variant="secondary"
												className="px-2 py-0.5 text-xs font-light"
											>
												{count} {count === 1 ? "record" : "records"}
											</Badge>
										</div>
									</div>
								</div>
							))
					) : null}
					{((hasCollections && recordCounts.records_per_collection && Object.keys(recordCounts.records_per_collection).length > 3) || 
					  (hasCollectionsFromProps && collections?.records_per_collection && Object.keys(collections.records_per_collection).length > 3)) && (
						<div className="pt-2.5 border-t border-nocta-200 dark:border-nocta-800/50">
							<Link
								to="/collections"
								className="text-sm text-nocta-600 dark:text-nocta-400 hover:text-nocta-900 dark:hover:text-nocta-100 font-light flex items-center gap-1 transition-colors duration-200 w-fit"
							>
								View{" "}
								{hasCollections 
									? Object.keys(recordCounts.records_per_collection).length - 3
									: collections?.records_per_collection ? Object.keys(collections.records_per_collection).length - 3 : 0}{" "}
								more collections
								<ArrowUpRightIcon size={12} />
							</Link>
						</div>
					)}
				</div>
				) : (
					<div className="text-center py-2">
						<div className="p-1.5 rounded-lg bg-nocta-100 dark:bg-nocta-800 text-nocta-400 dark:text-nocta-500 w-fit mx-auto mb-2.5">
							<DatabaseIcon size={20} />
						</div>
						<h3 className="text-sm font-light text-nocta-900 dark:text-nocta-100 mb-1.5">
							No collections yet
						</h3>
						<p className="text-xs text-nocta-600 dark:text-nocta-400 mb-2.5 max-w-sm mx-auto">
							Get started by creating your first data collection to organize
							your records.
						</p>
						<Link to="/collections">
							<Button size="sm" className="px-2.5 py-1">
								<PlusIcon size={14} />
								<span className="ml-1.5">Create Collection</span>
							</Button>
						</Link>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
