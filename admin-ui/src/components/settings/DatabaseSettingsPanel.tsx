import {
	DatabaseIcon,
	FloppyDiskIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useSettingsByCategory, useUpdateSetting } from "@/hooks";
import { createManualBackup } from "@/lib/api";
import type { SystemSetting } from "@/types/api";
import { createUpdateSettingSchema } from "./validation";

const BACKUP_SCHEDULE_OPTIONS = [
	{ value: "0 0 2 * * *", label: "Daily at 2:00 AM" },
	{ value: "0 0 */12 * * *", label: "Every 12 hours" },
	{ value: "0 0 */6 * * *", label: "Every 6 hours" },
	{ value: "0 0 */3 * * *", label: "Every 3 hours" },
	{ value: "0 0 0 * * 0", label: "Weekly (Sunday at midnight)" },
	{ value: "0 0 0 1 * *", label: "Monthly (1st day at midnight)" },
	{ value: "custom", label: "Custom cron expression" },
];

export function DatabaseSettingsPanel() {
	const { data: settings, isLoading } = useSettingsByCategory("database");
	const updateSettingMutation = useUpdateSetting();

	const manualBackupMutation = useMutation({
		mutationFn: createManualBackup,
		onSuccess: (data) => {
			toast({
				title: "Manual backup created successfully",
				description: `Backup ID: ${data.backup_id}`,
				variant: "success",
				position: "bottom-right",
				duration: 3000,
			});
		},
		onError: (error) => {
			toast({
				title: "Failed to create manual backup",
				description: error.message,
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
		},
	});

	const [formValues, setFormValues] = useState<Record<string, string>>({});
	const [hasChanges, setHasChanges] = useState(false);
	const [isCustomSchedule, setIsCustomSchedule] = useState(false);

	useEffect(() => {
		if (settings && Array.isArray(settings)) {
			const settingsMap = settings.reduce(
				(acc, setting) => {
					acc[setting.setting_key] = setting.setting_value;
					return acc;
				},
				{} as Record<string, string>,
			);
			setFormValues(settingsMap);

			const currentSchedule = settingsMap.backup_schedule;
			const isPredefined = BACKUP_SCHEDULE_OPTIONS.some(
				(option) =>
					option.value === currentSchedule && option.value !== "custom",
			);
			setIsCustomSchedule(!isPredefined);
		}
	}, [settings]);

	const handleInputChange = (key: string, value: string) => {
		setFormValues((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	const handleSwitchChange = (key: string, checked: boolean) => {
		setFormValues((prev) => ({ ...prev, [key]: checked.toString() }));
		setHasChanges(true);
	};

	const handleSave = async () => {
		if (!settings || !Array.isArray(settings)) return;

		for (const setting of settings) {
			const newValue = formValues[setting.setting_key];
			if (newValue !== setting.setting_value) {
				const schema = createUpdateSettingSchema(setting.data_type);
				const validationResult = schema.safeParse({
					setting_value: newValue,
				});

				if (!validationResult.success) {
					const errorMessage = validationResult.error.issues
						.map((issue) => issue.message)
						.join(", ");
					toast({
						title: "Validation Error",
						description: `Invalid value for ${setting.setting_key}: ${errorMessage}`,
						variant: "destructive",
						position: "bottom-right",
					});
					return;
				}

				await updateSettingMutation.mutateAsync({
					category: "database",
					settingKey: setting.setting_key,
					data: { setting_value: newValue },
				});
			}
		}
		setHasChanges(false);
	};

	const getSettingValue = (key: string) => {
		return formValues[key] || "";
	};

	const getSetting = (key: string): SystemSetting | undefined => {
		return settings && Array.isArray(settings)
			? settings.find((s) => s.setting_key === key)
			: undefined;
	};

	const requiresRestart = (key: string): boolean => {
		const setting = getSetting(key);
		return setting?.requires_restart || false;
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8">
					<Spinner className="w-6 h-6" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Database Settings
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<FormField className="w-96" name="backup_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable Backups</FormLabel>
									<FormDescription>
										{getSetting("backup_enabled")?.description ||
											"Enable or disable automatic database backups"}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("backup_enabled") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("backup_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="backup_compression">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable Compression</FormLabel>
									<FormDescription>
										{getSetting("backup_compression")?.description ||
											"Enable Gzip compression for backup files"}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("backup_compression") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("backup_compression", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="connection_pool_size">
							<div className="flex items-center gap-2">
								<FormLabel>Connection Pool Size</FormLabel>
								{requiresRestart("connection_pool_size") && (
									<Badge
										size="sm"
										variant="destructive"
										className="flex items-center gap-1 text-xs"
									>
										<span className="w-3 h-3">
											<WarningIcon size={12} />
										</span>
										Restart Required
									</Badge>
								)}
							</div>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("connection_pool_size")}
									onChange={(e) =>
										handleInputChange("connection_pool_size", e.target.value)
									}
									placeholder="Maximum database connections"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("connection_pool_size")?.description ||
									"Maximum number of database connections in the pool"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="backup_retention_days">
							<FormLabel>Backup Retention (days)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("backup_retention_days")}
									onChange={(e) =>
										handleInputChange("backup_retention_days", e.target.value)
									}
									placeholder="Days to keep backups"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_retention_days")?.description ||
									"Number of days to keep backup files"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="backup_schedule">
							<FormLabel>Backup Schedule (Cron)</FormLabel>
							<FormControl>
								<div className="space-y-2">
									<Select
										value={
											isCustomSchedule
												? "custom"
												: getSettingValue("backup_schedule")
										}
										onValueChange={(value) => {
											if (value === "custom") {
												setIsCustomSchedule(true);
											} else {
												setIsCustomSchedule(false);
												handleInputChange("backup_schedule", value);
											}
										}}
									>
										<SelectTrigger className="w-48">
											<SelectValue placeholder="Select backup schedule" />
										</SelectTrigger>
										<SelectContent>
											{BACKUP_SCHEDULE_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isCustomSchedule && (
										<Input
											type="text"
											value={getSettingValue("backup_schedule")}
											onChange={(e) =>
												handleInputChange("backup_schedule", e.target.value)
											}
											placeholder="0 0 2 * * *"
											className="w-48"
										/>
									)}
								</div>
							</FormControl>
							<FormDescription>
								{getSetting("backup_schedule")?.description ||
									"Cron expression for backup schedule (sec min hour day month dayofweek)"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="backup_prefix">
							<FormLabel>Backup Prefix</FormLabel>
							<FormControl>
								<Input
									type="text"
									value={getSettingValue("backup_prefix")}
									onChange={(e) =>
										handleInputChange("backup_prefix", e.target.value)
									}
									placeholder="lunarbase-backup"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_prefix")?.description ||
									"Prefix for backup files in S3 bucket"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="backup_min_size_bytes">
							<FormLabel>Minimum Backup Size (bytes)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("backup_min_size_bytes")}
									onChange={(e) =>
										handleInputChange("backup_min_size_bytes", e.target.value)
									}
									placeholder="1024"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_min_size_bytes")?.description ||
									"Minimum backup size to consider valid before cleanup"}
							</FormDescription>
						</FormField>
					</div>

					<div className="flex justify-between items-center pt-6">
						<Button
							type="button"
							variant="secondary"
							onClick={() => manualBackupMutation.mutate()}
							disabled={
								manualBackupMutation.isPending ||
								getSettingValue("backup_enabled") !== "true"
							}
							className="flex items-center gap-2"
						>
							{manualBackupMutation.isPending ? (
								<Spinner className="w-4 h-4" />
							) : (
								<span className="w-4 h-4">
									<DatabaseIcon size={16} />
								</span>
							)}
							Create Manual Backup
						</Button>

						<Button
							type="submit"
							disabled={!hasChanges || updateSettingMutation.isPending}
							className="flex items-center gap-2"
						>
							{updateSettingMutation.isPending ? (
								<Spinner className="w-4 h-4" />
							) : (
								<span className="w-4 h-4">
									<FloppyDiskIcon size={16} />
								</span>
							)}
							Save Changes
						</Button>
					</div>
				</Form>
			</CardContent>
		</Card>
	);
}
