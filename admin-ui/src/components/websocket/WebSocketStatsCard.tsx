import { MinusIcon, TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WebSocketStatsCardProps {
	title: string;
	value: string | number;
	icon: React.ElementType;
	unit?: string;
	trend?: {
		value: number;
		label: string;
	};
	description?: string;
}

export function WebSocketStatsCard({
	title,
	value,
	icon: Icon,
	unit,
	trend,
	description,
}: WebSocketStatsCardProps) {
	const getTrendIcon = () => {
		if (!trend) return null;
		if (trend.value > 0) return <TrendUpIcon size={16} />;
		if (trend.value < 0) return <TrendDownIcon size={16} />;
		return <MinusIcon size={16} />;
	};

	const getTrendColor = () => {
		if (!trend) return "";
		if (trend.value > 0) return "text-green-600 dark:text-green-400";
		if (trend.value < 0) return "text-red-600 dark:text-red-400";
		return "text-nocta-500 dark:text-nocta-400";
	};

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-light text-nocta-600 dark:text-nocta-400">
					{title}
				</CardTitle>
				<div className="flex items-center space-x-2">
					<div className="p-2">
						<Icon className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<div className="flex items-baseline space-x-2">
						<div className="text-2xl font-light text-nocta-900 dark:text-nocta-100">
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
