import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
	title: string;
	value: string | number;
	icon: React.ElementType;
	description: string;
}

export function StatCard({
	title,
	value,
	icon: Icon,
	description,
}: StatCardProps) {
	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-light text-nocta-600 dark:text-nocta-400">
					{title}
				</CardTitle>
				<div className="flex items-center space-x-2">
					<div className="p-2">
						<Icon size={16} color="oklch(0.708 0 0)" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<div className="flex items-baseline space-x-2">
						<div className="text-2xl font-light text-nocta-900 dark:text-nocta-100">
							{value}
						</div>
					</div>
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
