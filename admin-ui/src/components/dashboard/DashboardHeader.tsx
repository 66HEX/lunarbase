import { Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
	onRefresh: () => void;
	loading: boolean;
}

export function DashboardHeader({ onRefresh, loading }: DashboardHeaderProps) {
	return (
		<div className="dashboard-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-nocta-900 dark:text-nocta-100">
							Dashboard
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium w-fit"
						>
							Live
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Monitor and manage your LunarBase instance
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="flex items-center gap-2 text-xs sm:text-sm text-nocta-500 dark:text-nocta-500 order-2 sm:order-1">
						<Clock className="w-4 h-4" />
						<span className="hidden sm:inline">Last updated: </span>
						<span>{new Date().toLocaleTimeString()}</span>
					</div>
					<Button
						variant="primary"
						onClick={onRefresh}
						disabled={loading}
						className="w-full sm:w-auto order-1 sm:order-2"
					>
						<TrendingUp className="w-4 h-4 mr-2" />
						<span>Refresh</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
