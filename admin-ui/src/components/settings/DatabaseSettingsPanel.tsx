import { Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { useSettingsByCategory } from "@/hooks/configuration/useConfiguration";
import { useUpdateSetting } from "@/hooks/configuration/useConfigurationMutations";
import type { SystemSetting } from "@/types/api";

export function DatabaseSettingsPanel() {
	const { data: settings, isLoading } = useSettingsByCategory("database");
	const updateSettingMutation = useUpdateSetting();

	// Local state for form values
	const [formValues, setFormValues] = useState<Record<string, string>>({});
	const [hasChanges, setHasChanges] = useState(false);

	// Initialize form values when settings are loaded
	useEffect(() => {
		if (settings && Array.isArray(settings)) {
			const settingsMap = settings.reduce((acc, setting) => {
				acc[setting.setting_key] = setting.setting_value;
				return acc;
			}, {} as Record<string, string>);
			setFormValues(settingsMap);
		}
	}, [settings]);

	// Handle input changes
	const handleInputChange = (key: string, value: string) => {
		setFormValues((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	// Handle switch changes
	const handleSwitchChange = (key: string, checked: boolean) => {
		setFormValues((prev) => ({ ...prev, [key]: checked.toString() }));
		setHasChanges(true);
	};

	// Save changes
	const handleSave = async () => {
		if (!settings || !Array.isArray(settings)) return;

		for (const setting of settings) {
			const newValue = formValues[setting.setting_key];
			if (newValue !== setting.setting_value) {
				await updateSettingMutation.mutateAsync({
					category: "database",
					settingKey: setting.setting_key,
					data: { setting_value: newValue }
				});
			}
		}
		setHasChanges(false);
	};

	// Get setting value helper
	const getSettingValue = (key: string) => {
		return formValues[key] || "";
	};

	// Get setting by key helper
	const getSetting = (key: string): SystemSetting | undefined => {
		return settings && Array.isArray(settings) ? settings.find((s) => s.setting_key === key) : undefined;
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
				<Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
					<div className="space-y-6">
						{/* Connection Pooling */}
						<FormField name="connection_pool_size">
							<FormLabel>Connection Pool Size</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("connection_pool_size")}
									onChange={(e) => handleInputChange("connection_pool_size", e.target.value)}
									placeholder="Maximum database connections"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("connection_pool_size")?.description || "Maximum number of database connections in the pool"}
							</FormDescription>
						</FormField>

						{/* Backup Interval */}
						<FormField name="backup_interval_hours">
							<FormLabel>Backup Interval (hours)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("backup_interval_hours")}
									onChange={(e) => handleInputChange("backup_interval_hours", e.target.value)}
									placeholder="Backup interval in hours"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_interval_hours")?.description || "How often to create database backups"}
							</FormDescription>
						</FormField>

						{/* Backup Enabled */}
						<FormField name="backup_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable Backups</FormLabel>
									<FormDescription>
										{getSetting("backup_enabled")?.description || "Enable or disable automatic database backups"}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("backup_enabled") === "true"}
										onCheckedChange={(checked) => handleSwitchChange("backup_enabled", checked)}
									/>
								</FormControl>
							</div>
						</FormField>

						{/* Backup Retention Days */}
						<FormField name="backup_retention_days">
							<FormLabel>Backup Retention (days)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("backup_retention_days")}
									onChange={(e) => handleInputChange("backup_retention_days", e.target.value)}
									placeholder="Days to keep backups"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_retention_days")?.description || "Number of days to keep backup files"}
							</FormDescription>
						</FormField>

						{/* Backup Schedule */}
						<FormField name="backup_schedule">
							<FormLabel>Backup Schedule (Cron)</FormLabel>
							<FormControl>
								<Input
									type="text"
									value={getSettingValue("backup_schedule")}
									onChange={(e) => handleInputChange("backup_schedule", e.target.value)}
									placeholder="0 0 2 * * *"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_schedule")?.description || "Cron expression for backup schedule (sec min hour day month dayofweek)"}
							</FormDescription>
						</FormField>

						{/* Backup Compression */}
						<FormField name="backup_compression">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable Compression</FormLabel>
									<FormDescription>
										{getSetting("backup_compression")?.description || "Enable Gzip compression for backup files"}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("backup_compression") === "true"}
										onCheckedChange={(checked) => handleSwitchChange("backup_compression", checked)}
									/>
								</FormControl>
							</div>
						</FormField>

						{/* Backup Prefix */}
						<FormField name="backup_prefix">
							<FormLabel>Backup Prefix</FormLabel>
							<FormControl>
								<Input
									type="text"
									value={getSettingValue("backup_prefix")}
									onChange={(e) => handleInputChange("backup_prefix", e.target.value)}
									placeholder="lunarbase-backup"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_prefix")?.description || "Prefix for backup files in S3 bucket"}
							</FormDescription>
						</FormField>

						{/* Backup Minimum Size */}
						<FormField name="backup_min_size_bytes">
							<FormLabel>Minimum Backup Size (bytes)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("backup_min_size_bytes")}
									onChange={(e) => handleInputChange("backup_min_size_bytes", e.target.value)}
									placeholder="1024"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("backup_min_size_bytes")?.description || "Minimum backup size to consider valid before cleanup"}
							</FormDescription>
						</FormField>

						{/* Save Button */}
						{hasChanges && (
							<div className="flex justify-end pt-4">
								<Button
									type="submit"
									disabled={updateSettingMutation.isPending}
									className="flex items-center gap-2"
								>
									{updateSettingMutation.isPending ? (
										<Spinner className="w-4 h-4" />
									) : (
										<Save className="w-4 h-4" />
									)}
									Save Changes
								</Button>
							</div>
						)}
					</div>
				</Form>

			</CardContent>
		</Card>
	);
}