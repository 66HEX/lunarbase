import { ArrowUpRightIcon, LightningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { CreateCollectionSheet } from "@/components/collections";
import { CreateRoleSheet } from "@/components/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserSheet } from "@/components/users";
import { usePrefetch } from "@/hooks";
import { useClientStore } from "@/stores/client.store";

interface QuickAction {
	name: string;
	href?: string;
	action?: string;
	icon: React.ElementType;
}

interface QuickActionsCardProps {
	actions: QuickAction[];
}

export function QuickActionsCard({ actions }: QuickActionsCardProps) {
	const { prefetchRecords, prefetchWebSocket } = usePrefetch();
	const sheets = useClientStore((state) => state.ui.sheets);
	const openSheet = useClientStore((state) => state.openSheet);
	const closeSheet = useClientStore((state) => state.closeSheet);

	const handleMouseEnter = (href?: string) => {
		if (!href) return;
		switch (href) {
			case "/records":
				prefetchRecords();
				break;
			case "/websocket":
				prefetchWebSocket();
				break;
			default:
				break;
		}
	};

	const handleActionClick = (action: QuickAction) => {
		if (action.action === "create-collection") {
			openSheet("createCollection");
		} else if (action.action === "create-user") {
			openSheet("createUser");
		} else if (action.action === "create-role") {
			openSheet("createRole");
		}
	};

	return (
		<Card className="dashboard-card">
			<CardHeader className="pb-3 p-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<div className="p-1">
						<LightningIcon size={14} />
					</div>
					Quick Actions
				</CardTitle>
			</CardHeader>
			<CardContent className="p-3 pt-0">
				<div className="grid grid-cols-1 gap-1.5">
					{actions.map((action) => {
						if (action.action) {
							return (
								<button
									key={action.name}
									type="button"
									className="block group w-full text-left cursor-pointer"
									onClick={() => handleActionClick(action)}
								>
									<div className="flex items-center p-2 rounded-lg transition-all duration-200 ease-in-out group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm">
										<div className="w-6 h-6 rounded-md flex items-center justify-center mr-2.5 group-hover:bg-nocta-200 dark:group-hover:bg-nocta-700/50 transition-colors">
											<action.icon className="w-3.5 h-3.5 text-nocta-700 dark:text-nocta-300" />
										</div>
										<div className="flex-1">
											<span className="font-light text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
												{action.name}
											</span>
										</div>
										<span className="w-3.5 h-3.5 text-nocta-400 dark:text-nocta-500 transition-all group-hover:text-nocta-700 dark:group-hover:text-nocta-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
											<ArrowUpRightIcon size={14} />
										</span>
									</div>
								</button>
							);
						}

						return (
							<Link
								key={action.name}
								to={action.href!}
								className="block group"
								onMouseEnter={() => handleMouseEnter(action.href)}
							>
								<div className="flex items-center p-2 rounded-lg transition-all duration-200 ease-in-out group-hover:bg-nocta-100 dark:group-hover:bg-nocta-800/50 group-hover:shadow-sm">
									<div className="w-6 h-6 rounded-md flex items-center justify-center mr-2.5 group-hover:bg-nocta-200 dark:group-hover:bg-nocta-700/50 transition-colors">
										<action.icon className="w-3.5 h-3.5 text-nocta-700 dark:text-nocta-300" />
									</div>
									<div className="flex-1">
										<span className="font-light text-sm text-nocta-900 dark:text-nocta-100 group-hover:text-nocta-700 dark:group-hover:text-nocta-200">
											{action.name}
										</span>
									</div>
									<span className="w-3.5 h-3.5 text-nocta-400 dark:text-nocta-500 transition-all group-hover:text-nocta-700 dark:group-hover:text-nocta-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
										<ArrowUpRightIcon size={14} />
									</span>
								</div>
							</Link>
						);
					})}
				</div>
			</CardContent>
			<CreateCollectionSheet
				isOpen={sheets.createCollection || false}
				onOpenChange={(open) =>
					open ? openSheet("createCollection") : closeSheet("createCollection")
				}
			/>
			<CreateUserSheet
				isOpen={sheets.createUser || false}
				onOpenChange={(open) =>
					open ? openSheet("createUser") : closeSheet("createUser")
				}
			/>
			<CreateRoleSheet
				isOpen={sheets.createRole || false}
				onOpenChange={(open) =>
					open ? openSheet("createRole") : closeSheet("createRole")
				}
			/>
		</Card>
	);
}
