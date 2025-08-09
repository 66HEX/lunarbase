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
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-nocta-900 dark:text-nocta-100">
							Settings
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							{totalSettings} settings
						</Badge>
					</div>
					<p className="text-sm sm:text-base lg:text-lg text-nocta-600 dark:text-nocta-400">
						Configure system settings and preferences
					</p>
				</div>
			</div>
		</div>
	);
}
