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
			<MetricsHeader />

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
				<div className="xl:col-span-2">
					<MetricsSummary />
				</div>

				<div className="xl:col-span-2">
					<RawMetricsViewer />
				</div>
			</div>
		</div>
	);
}

export default MetricsComponent;
