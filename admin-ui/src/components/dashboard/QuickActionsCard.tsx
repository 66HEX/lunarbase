import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAction {
	name: string;
	href: string;
	icon: React.ElementType;
	color: string;
}

interface QuickActionsCardProps {
	actions: QuickAction[];
}

export function QuickActionsCard({ actions }: QuickActionsCardProps) {
	return (
		<Card className="dashboard-card">
			<CardHeader className="pb-6 p-4">
				<CardTitle className="flex items-center gap-2 text-lg">
					<div className="p-1.5 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
						<Zap className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
					</div>
					Quick Actions
				</CardTitle>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid grid-cols-1 gap-2">
					{actions.map((action) => (
						<Link key={action.name} to={action.href} className="block group">
							<div className="flex items-center p-3 rounded-lg transition-all duration-200 ease-in-out group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm">
								<div className="w-8 h-8 rounded-lg bg-nocta-100 dark:bg-nocta-800/30 flex items-center justify-center mr-3 group-hover:bg-nocta-200 dark:group-hover:bg-nocta-700/50 transition-colors">
									<action.icon className="w-4 h-4 text-nocta-700 dark:text-nocta-300" />
								</div>
								<div className="flex-1">
									<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
										{action.name}
									</span>
								</div>
								<ArrowUpRight className="w-4 h-4 text-nocta-400 dark:text-nocta-500 transition-all group-hover:text-nocta-700 dark:group-hover:text-nocta-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
							</div>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
