import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WebSocketStats } from "@/types/api";

interface WebSocketSubscriptionsProps {
	stats: WebSocketStats | undefined;
}

export function WebSocketSubscriptions({ stats }: WebSocketSubscriptionsProps) {
	if (
		!stats?.subscriptions_by_collection ||
		Object.keys(stats.subscriptions_by_collection).length === 0
	) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Subscriptions by Collection
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{Object.entries(stats.subscriptions_by_collection).map(
						([collection, count]) => (
							<div
								key={collection}
								className="p-4 rounded-lg bg-nocta-50 dark:bg-nocta-800/30 "
							>
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium text-nocta-900 dark:text-nocta-100">
											{collection}
										</h4>
										<p className="text-sm text-nocta-600 dark:text-nocta-400">
											Collection
										</p>
									</div>
									<div className="text-right">
										<div className="text-2xl font-medium text-nocta-900 dark:text-nocta-100">
											{count}
										</div>
										<div className="text-xs text-nocta-500 dark:text-nocta-500">
											subscriptions
										</div>
									</div>
								</div>
							</div>
						),
					)}
				</div>
			</CardContent>
		</Card>
	);
}
