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
			<CardHeader className="pb-3 p-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<div className="p-1 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
						<Zap className="w-3.5 h-3.5 text-nocta-700 dark:text-nocta-300" />
					</div>
					Quick Actions
				</CardTitle>
			</CardHeader>
			<CardContent className="p-3 pt-0">
				<div className="grid grid-cols-1 gap-1.5">
					{actions.map((action) => (
						<Link key={action.name} to={action.href} className="block group">
							<div className="flex items-center p-2 rounded-lg transition-all duration-200 ease-in-out group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm">
								<div className="w-6 h-6 rounded-md bg-nocta-100 dark:bg-nocta-800/30 flex items-center justify-center mr-2.5 group-hover:bg-nocta-200 dark:group-hover:bg-nocta-700/50 transition-colors">
									<action.icon className="w-3.5 h-3.5 text-nocta-700 dark:text-nocta-300" />
								</div>
								<div className="flex-1">
									<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
										{action.name}
									</span>
								</div>
								<ArrowUpRight className="w-3.5 h-3.5 text-nocta-400 dark:text-nocta-500 transition-all group-hover:text-nocta-700 dark:group-hover:text-nocta-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
							</div>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
