import { Activity, Database, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMetricsQuery } from "@/hooks/";
import { MetricCard } from "./MetricCard";

export function MetricsSummary() {
	const { data: metrics, isLoading, error, refetch } = useMetricsQuery();

	if (isLoading && !metrics) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center h-64">
					<div className="text-center">
						<Spinner className="w-8 h-8 mx-auto mb-4" />
						<p className="text-nocta-600 dark:text-nocta-400">
							Loading metrics summary...
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center h-64">
					<div className="text-center">
						<p className="text-red-600 dark:text-red-400 mb-4">
							Error loading metrics: {error.message}
						</p>
						<Button onClick={() => refetch()} variant="primary">
							<RefreshCw className="w-4 h-4 mr-2" />
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!metrics) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center h-64">
					<p className="text-nocta-600 dark:text-nocta-400">
						No metrics data available
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Metrics Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<MetricCard
					title="HTTP Requests"
					value={metrics.http_requests_total.toLocaleString()}
					icon={Globe}
					unit="total"
					description="Total number of HTTP requests processed since server start"
				/>

				<MetricCard
					title="Active WebSocket Connections"
					value={metrics.active_websocket_connections}
					icon={Activity}
					unit="connections"
					description="Number of currently active WebSocket connections"
				/>

				<MetricCard
					title="Database Connections"
					value={metrics.database_connections_active}
					icon={Database}
					unit="active"
					description="Number of active database connections in the pool"
				/>
			</div>
		</div>
	);
}
