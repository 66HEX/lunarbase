import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MetricCardProps {
	title: string;
	value: string | number;
	icon: React.ElementType;
	unit?: string;
	trend?: {
		value: number;
		label: string;
	};
	status?: "healthy" | "warning" | "error";
	description?: string;
}

export function MetricCard({
	title,
	value,
	icon: Icon,
	unit,
	trend,
	status = "healthy",
	description,
}: MetricCardProps) {
	const getTrendIcon = () => {
		if (!trend) return null;
		if (trend.value > 0) return <TrendingUp className="w-4 h-4" />;
		if (trend.value < 0) return <TrendingDown className="w-4 h-4" />;
		return <Minus className="w-4 h-4" />;
	};

	const getTrendColor = () => {
		if (!trend) return "";
		if (trend.value > 0) return "text-green-600 dark:text-green-400";
		if (trend.value < 0) return "text-red-600 dark:text-red-400";
		return "text-nocta-500 dark:text-nocta-400";
	};

	const getStatusColor = () => {
		switch (status) {
			case "healthy":
				return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
			case "warning":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
			case "error":
				return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
			default:
				return "bg-nocta-100 text-nocta-800 dark:bg-nocta-800/20 dark:text-nocta-400";
		}
	};

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
					{title}
				</CardTitle>
				<div className="flex items-center space-x-2">
					<Badge variant="secondary" className={getStatusColor()}>
						{status}
					</Badge>
					<div className="p-2 rounded-lg bg-nocta-100 dark:bg-nocta-800/30">
						<Icon className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<div className="flex items-baseline space-x-2">
						<div className="text-2xl font-bold text-nocta-900 dark:text-nocta-100">
							{value}
						</div>
						{unit && (
							<div className="text-sm text-nocta-500 dark:text-nocta-400">
								{unit}
							</div>
						)}
					</div>
					{trend && (
						<div
							className={`flex items-center space-x-1 text-sm ${getTrendColor()}`}
						>
							{getTrendIcon()}
							<span>{trend.label}</span>
						</div>
					)}
					{description && (
						<p className="text-xs text-nocta-500 dark:text-nocta-400 mt-2">
							{description}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
