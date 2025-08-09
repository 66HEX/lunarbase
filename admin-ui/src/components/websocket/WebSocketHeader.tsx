import { Radio, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WebSocketHeaderProps {
	activeConnections: number;
	onRefresh: () => void;
	onBroadcast: () => void;
	isLoading: boolean;
}

export function WebSocketHeader({
	activeConnections,
	onRefresh,
	onBroadcast,
	isLoading,
}: WebSocketHeaderProps) {
	return (
		<div className="websocket-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-nocta-900 dark:text-nocta-100">
							WebSocket Management
						</h1>
						<Badge
							variant={activeConnections ? "success" : "secondary"}
							className="px-2 py-0.5 text-xs font-medium w-fit"
						>
							{activeConnections || 0} active
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Monitor real-time connections and manage WebSocket activity
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button
						variant="ghost"
						size="sm"
						onClick={onRefresh}
						disabled={isLoading}
						className="w-full sm:w-auto"
					>
						<RefreshCw
							className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
						/>
						<span>Refresh</span>
					</Button>
					<Button
						className="px-4 py-2 w-full sm:w-auto"
						onClick={onBroadcast}
						disabled={!activeConnections}
					>
						<Radio className="w-4 h-4 mr-2" />
						<span className="sm:inline">Broadcast Message</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
