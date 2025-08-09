import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
	title: string;
	value: string | number;
	icon: React.ElementType;
	href: string;
	detail: string;
}

export function StatCard({
	title,
	value,
	icon: Icon,
	href,
	detail,
}: StatCardProps) {
	return (
		<Card className="dashboard-card h-full group">
			<Link to={href} className="block h-full">
				<CardContent className="p-4 flex flex-col justify-between h-full">
					<div>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 rounded-lg duration-200 ease-in-out bg-nocta-100 dark:bg-nocta-800/30 group-hover:bg-nocta-200 dark:group-hover:bg-nocta-700/50 transition-colors">
								<Icon className="w-5 h-5 text-nocta-700 dark:text-nocta-300" />
							</div>
							<ArrowUpRight className="w-5 h-5 duration-200 ease-in-out text-nocta-400 dark:text-nocta-500 opacity-0 transition-all group-hover:opacity-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
						</div>
						<div className="space-y-2">
							<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400 uppercase tracking-wide">
								{title}
							</p>
							<p className="text-3xl font-medium text-nocta-900 dark:text-nocta-100 leading-none">
								{value}
							</p>
						</div>
					</div>
					<div className="mt-3 duration-300 ease-in-out flex items-center text-sm text-nocta-600 dark:text-nocta-400 transition-colors group-hover:text-nocta-900 dark:group-hover:text-nocta-100">
						<span className="font-medium">{detail}</span>
					</div>
				</CardContent>
			</Link>
		</Card>
	);
}
