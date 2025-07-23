import { createFileRoute } from "@tanstack/react-router";
import {
	MetricsHeader,
	MetricsSummary,
	RawMetricsViewer,
} from "@/components/metrics";

export const Route = createFileRoute("/metrics")({
	component: MetricsComponent,
});

function MetricsComponent() {
	return (
		<div className="space-y-4">
			{/* Page Header */}
			<MetricsHeader />

			{/* Bento Grid Layout */}
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
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
