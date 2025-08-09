export function MetricsHeader() {
	return (
		<div className="metrics-header">
			<div className="flex flex-col justify-start items-start gap-1">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-nocta-900 dark:text-nocta-100">
						Metrics & Monitoring
					</h1>
				</div>
				<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
					Real-time system metrics and Prometheus data
				</p>
			</div>
		</div>
	);
}
