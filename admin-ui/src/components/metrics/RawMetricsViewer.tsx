import { Copy, Download, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useRawMetricsQuery } from "@/hooks/";

export function RawMetricsViewer() {
	const { data: rawMetrics, isLoading, error, refetch } = useRawMetricsQuery();
	const [searchTerm, setSearchTerm] = useState("");

	const handleCopy = async () => {
		if (!rawMetrics) return;
		try {
			await navigator.clipboard.writeText(rawMetrics);
			toast({
				title: "Copied to clipboard",
				description: "Raw metrics data has been copied to your clipboard.",
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch {
			toast({
				title: "Copy failed",
				description: "Failed to copy metrics to clipboard.",
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		}
	};

	const handleDownload = () => {
		if (!rawMetrics) return;
		const blob = new Blob([rawMetrics], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const filteredMetrics = rawMetrics
		? rawMetrics
				.split("\n")
				.filter(
					(line) =>
						searchTerm === "" ||
						line.toLowerCase().includes(searchTerm.toLowerCase()),
				)
				.join("\n")
		: "";

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center h-64">
					<div className="text-center">
						<Spinner className="w-8 h-8 mx-auto mb-4" />
						<p className="text-nocta-600 dark:text-nocta-400">
							Loading metrics...
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

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Raw Prometheus Metrics</CardTitle>
					<div className="flex items-center space-x-2">
						<div className="relative flex-1">
							<Input
								placeholder="Search metrics..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
								leftIcon={
									<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
								}
							/>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => refetch()}
							disabled={isLoading}
						>
							<RefreshCw className="w-4 h-4 mr-2" />
							Refresh
						</Button>
						<Button variant="secondary" size="sm" onClick={handleCopy}>
							<Copy className="w-4 h-4 mr-2" />
							Copy
						</Button>
						<Button variant="primary" size="sm" onClick={handleDownload}>
							<Download className="w-4 h-4 mr-2" />
							Download
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="relative">
					<pre className="bg-nocta-50 dark:bg-nocta-900/50 p-4 rounded-lg text-sm font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
						<code className="text-nocta-800 dark:text-nocta-200">
							{filteredMetrics || "No metrics data available"}
						</code>
					</pre>
					{searchTerm && (
						<div className="mt-2 text-sm text-nocta-600 dark:text-nocta-400">
							Showing filtered results for "{searchTerm}"
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
