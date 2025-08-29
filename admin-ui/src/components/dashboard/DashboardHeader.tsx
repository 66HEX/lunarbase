import { ClockIcon, TrendUpIcon } from "@phosphor-icons/react";
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
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							Dashboard
						</h1>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="flex items-center gap-2 text-xs sm:text-sm text-nocta-500 dark:text-nocta-500 order-2 sm:order-1">
						<ClockIcon size={16} />
						<span className="hidden sm:inline">Last updated: </span>
						<span>{new Date().toLocaleTimeString()}</span>
					</div>
					<Button
						variant="primary"
						onClick={onRefresh}
						disabled={loading}
						className="w-full sm:w-auto order-1 sm:order-2"
					>
						<TrendUpIcon size={16} />
						<span className="ml-2">Refresh</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
