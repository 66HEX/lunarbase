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
			<div className="flex items-start justify-between mb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							Dashboard
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							Live
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Monitor and manage your LunarBase instance
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 text-sm text-nocta-500 dark:text-nocta-500">
						<Clock className="w-4 h-4" />
						<span>Last updated: {new Date().toLocaleTimeString()}</span>
					</div>
					<Button variant="primary" onClick={onRefresh} disabled={loading}>
						<TrendingUp className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>
		</div>
	);
}
