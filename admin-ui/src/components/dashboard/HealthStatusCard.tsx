import { AlertTriangle, CheckCircle, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HealthResponse } from "@/types/api";

interface HealthStatusCardProps {
	health: HealthResponse | null | undefined;
}

export function HealthStatusCard({ health }: HealthStatusCardProps) {
	if (!health) return null;

	const isHealthy = health?.status === "healthy";
	const dbHealthy = health.database?.status === "healthy";

	return (
		<Card className="dashboard-card">
			<CardHeader className="pb-4 p-4">
				<CardTitle className="flex items-center gap-2 text-lg">
					<div className="p-1.5 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
						<Server className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
					</div>
					System Health
					{isHealthy ? (
						<CheckCircle className="w-4 h-4 text-green-500" />
					) : (
						<AlertTriangle className="w-4 h-4 text-red-500" />
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-4">
				<div className="space-y-4">
					{/* API Server Status */}
					<div className="flex items-center justify-between p-3 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg">
						<div className="flex items-center gap-3">
							<div
								className={`w-2 h-2 rounded-full ${isHealthy ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
							></div>
							<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100">
								API Server
							</span>
						</div>
						<Badge
							variant={isHealthy ? "success" : "destructive"}
							className="px-2 py-0.5 text-xs font-medium"
						>
							{isHealthy ? "Healthy" : "Unhealthy"}
						</Badge>
					</div>

					{/* Database Status */}
					<div className="flex items-center justify-between p-3 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg">
						<div className="flex items-center gap-3">
							<div
								className={`w-2 h-2 rounded-full ${dbHealthy ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
							></div>
							<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100">
								Database
							</span>
						</div>
						<Badge
							variant={dbHealthy ? "success" : "destructive"}
							className="px-2 py-0.5 text-xs font-medium capitalize"
						>
							{health.database?.status || "Unknown"}
						</Badge>
					</div>

					{/* System Metrics */}
					<div className="space-y-3 pt-3 border-t border-nocta-200 dark:border-nocta-800/50">
						{/* Memory Usage */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100">
									Memory Usage
								</span>
								<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
									{health.memory?.usage_percentage?.toFixed(1) || "0"}%
								</span>
							</div>
							<Progress
								value={health.memory?.usage_percentage || 0}
								className="h-1.5"
							/>
							<div className="flex justify-between text-xs text-nocta-500 dark:text-nocta-500">
								<span>{health.memory?.used_mb?.toFixed(1) || "0"} MB used</span>
								<span>
									{health.memory?.total_mb?.toFixed(1) || "0"} MB total
								</span>
							</div>
						</div>

						{/* CPU Usage */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100">
									CPU Usage
								</span>
								<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
									{health.system?.cpu_usage?.toFixed(1) || "0"}%
								</span>
							</div>
							<Progress
								value={health.system?.cpu_usage || 0}
								className="h-1.5"
							/>
						</div>

						{/* Additional Metrics */}
						<div className="grid grid-cols-2 gap-3 pt-2">
							<div className="text-center p-2 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg">
								<div className="text-xs text-nocta-500 dark:text-nocta-500">
									Uptime
								</div>
								<div className="text-sm font-medium text-nocta-900 dark:text-nocta-100">
									{health.uptime
										? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
										: "0h 0m"}
								</div>
							</div>
							<div className="text-center p-2 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg">
								<div className="text-xs text-nocta-500 dark:text-nocta-500">
									Version
								</div>
								<div className="text-sm font-medium text-nocta-900 dark:text-nocta-100">
									v{health.version || "Unknown"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
