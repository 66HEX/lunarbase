import { Badge } from "@/components/ui/badge";

interface SettingsHeaderProps {
	totalSettings: number;
}

export function SettingsHeader({ totalSettings }: SettingsHeaderProps) {
	return (
		<div className="settings-header">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl font-light text-nocta-900 dark:text-nocta-100">
							Settings
						</h1>
						<Badge
							size="sm"
							variant="secondary"
							className="text-xs font-light"
						>
							{totalSettings} settings
						</Badge>
					</div>
				</div>
			</div>
		</div>
	);
}
