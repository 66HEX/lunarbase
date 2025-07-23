import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WebSocketActivityResponse } from "@/types/api";

interface WebSocketActivityProps {
	activity: WebSocketActivityResponse | undefined;
}

export function WebSocketActivity({ activity }: WebSocketActivityProps) {
	const actionColors = {
		connected: "text-green-600 dark:text-green-400",
		disconnected: "text-red-600 dark:text-red-400",
		subscribed: "text-blue-600 dark:text-blue-400",
		unsubscribed: "text-yellow-600 dark:text-yellow-400",
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Recent Activity
					<Badge variant="secondary" className="ml-auto">
						{activity?.activities?.length || 0}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{activity?.activities && activity.activities.length > 0 ? (
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{activity.activities.slice(0, 10).map((item, index) => {
							return (
								<div
									key={`${item.connection_id}-${item.timestamp}-${index}`}
									className="flex items-start gap-3 p-3 rounded-lg bg-nocta-50 dark:bg-nocta-800/30"
								>
									<div className="flex-shrink-0 mt-0.5">
										<div className={`w-2 h-2 rounded-full ${actionColors[item.action as keyof typeof actionColors] ? "bg-current" : "bg-gray-400"} ${actionColors[item.action as keyof typeof actionColors] || "text-gray-400"}`} />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className={`text-sm font-medium ${actionColors[item.action as keyof typeof actionColors] || "text-nocta-600 dark:text-nocta-400"}`}>
												{item.action}
											</span>
											<span className="text-xs text-nocta-500 dark:text-nocta-500">
												{new Date(item.timestamp).toLocaleTimeString()}
											</span>
										</div>
										<div className="text-xs text-nocta-600 dark:text-nocta-400 font-mono">
											{item.connection_id}
											{item.user_id && ` (User ${item.user_id})`}
										</div>
										{item.details && (
											<div className="text-xs text-nocta-500 dark:text-nocta-500 mt-1 truncate">
												{item.details}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="text-center py-8">
						<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
							<Activity className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
						</div>
						<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
							No recent activity
						</h3>
						<p className="text-nocta-600 dark:text-nocta-400">
							WebSocket activity will appear here
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}