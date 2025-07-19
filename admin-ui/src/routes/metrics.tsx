import { createFileRoute } from "@tanstack/react-router";
import { MetricsSummary, RawMetricsViewer } from "@/components/metrics";

export const Route = createFileRoute("/metrics")({
	component: MetricsComponent,
});

function MetricsComponent() {
	return (
		<div className="space-y-4">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
						Metrics & Monitoring
					</h1>
					<p className="text-lg text-nocta-600 dark:text-nocta-400 mt-2">
						Real-time system metrics and Prometheus data
					</p>
				</div>
			</div>

			{/* Bento Grid Layout */}
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
				{/* Metrics Summary - Takes 2 columns on xl screens */}
				<div className="xl:col-span-2">
					<MetricsSummary />
				</div>

				{/* Raw Metrics Viewer - Takes 1 column on xl screens */}
				<div className="xl:col-span-2">
					<RawMetricsViewer />
				</div>
			</div>
		</div>
	);
}

export default MetricsComponent;
