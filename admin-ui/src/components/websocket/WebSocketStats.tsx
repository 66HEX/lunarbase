import { WebSocketStatsCard } from "@/components/websocket/WebSocketStatsCard";
import type { WebSocketStats as WebSocketStatsType } from "@/types/api";
import { webSocketStatsConfig } from "./constants";

interface WebSocketStatsProps {
	stats: WebSocketStatsType | undefined;
}

export function WebSocketStats({ stats }: WebSocketStatsProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{webSocketStatsConfig.map((config) => {
				const value = config.valueTransform
					? config.valueTransform(stats)
					: (stats?.[config.key as keyof WebSocketStatsType] as
							| string
							| number) || 0;

				return (
					<WebSocketStatsCard
						key={config.key}
						title={config.title}
						value={value}
						icon={config.icon}
						unit={config.unit}
						description={config.description}
					/>
				);
			})}
		</div>
	);
}
