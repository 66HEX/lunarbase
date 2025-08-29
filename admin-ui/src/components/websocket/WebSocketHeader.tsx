import { RadioButtonIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
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
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							WebSocket Management
						</h1>
						<Badge
							variant={activeConnections ? "success" : "secondary"}
							className="px-2 py-0.5 text-xs font-light w-fit"
						>
							{activeConnections || 0} active
						</Badge>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button
						variant="ghost"
						size="sm"
						onClick={onRefresh}
						disabled={isLoading}
						className="w-full sm:w-auto"
					>
						<span className={`mr-2 ${isLoading ? "animate-spin" : ""}`}>
						<ArrowClockwiseIcon size={16} />
					</span>
						<span>Refresh</span>
					</Button>
					<Button
						className="px-4 py-2 w-full sm:w-auto"
						onClick={onBroadcast}
						disabled={!activeConnections}
					>
						<span className="mr-2">
					<RadioButtonIcon size={16} />
				</span>
						<span className="sm:inline">Broadcast Message</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
