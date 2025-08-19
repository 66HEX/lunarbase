import { Save } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { useSettingsByCategory, useUpdateSetting } from "@/hooks";
import type { SystemSetting } from "@/types/api";

export function AuthSettingsPanel() {
	const { data: settings, isLoading } = useSettingsByCategory("auth");
	const updateSettingMutation = useUpdateSetting();

	const [localSettings, setLocalSettings] = useState<Record<string, string>>(
		{},
	);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (settings && Array.isArray(settings)) {
			const settingsMap = settings.reduce(
				(acc, setting) => {
					acc[setting.setting_key] = setting.setting_value;
					return acc;
				},
				{} as Record<string, string>,
			);
			setLocalSettings(settingsMap);
		}
	}, [settings]);

	const getSetting = (key: string): SystemSetting | undefined => {
		return settings && Array.isArray(settings)
			? settings.find((s) => s.setting_key === key)
			: undefined;
	};

	const getSettingValue = (key: string): string => {
		return localSettings[key] || "";
	};

	const handleInputChange = (key: string, value: string) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	const handleSave = async () => {
		if (!settings) return;

		for (const setting of settings) {
			const newValue = localSettings[setting.setting_key];
			if (newValue !== setting.setting_value) {
				await updateSettingMutation.mutateAsync({
					category: "auth",
					settingKey: setting.setting_key,
					data: { setting_value: newValue },
				});
			}
		}
		setHasChanges(false);
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
					Authentication Settings
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<div className="space-y-6">
						{/* JWT Lifetime */}
						<FormField name="jwt_lifetime_hours">
							<FormLabel>JWT Lifetime (hours)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("jwt_lifetime_hours")}
									onChange={(e) =>
										handleInputChange("jwt_lifetime_hours", e.target.value)
									}
									placeholder="Token lifetime in hours"
									className="w-48"
									min="1"
									max="168"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("jwt_lifetime_hours")?.description ||
									"How long JWT tokens remain valid (1-168 hours)"}
							</FormDescription>
						</FormField>

						{/* Lockout Duration */}
						<FormField name="lockout_duration_minutes">
							<FormLabel>Lockout Duration (minutes)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("lockout_duration_minutes")}
									onChange={(e) =>
										handleInputChange(
											"lockout_duration_minutes",
											e.target.value,
										)
									}
									placeholder="Account lockout duration"
									className="w-48"
									min="1"
									max="1440"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("lockout_duration_minutes")?.description ||
									"How long accounts remain locked after failed login attempts (1-1440 minutes)"}
							</FormDescription>
						</FormField>

						{/* Max Login Attempts */}
						<FormField name="max_login_attempts">
							<FormLabel>Max Login Attempts</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("max_login_attempts")}
									onChange={(e) =>
										handleInputChange("max_login_attempts", e.target.value)
									}
									placeholder="Maximum login attempts"
									className="w-48"
									min="1"
									max="20"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("max_login_attempts")?.description ||
									"Maximum failed login attempts before account lockout (1-20 attempts)"}
							</FormDescription>
						</FormField>

						{/* Save Button */}
						<div className="flex justify-end pt-4">
							<Button
								type="submit"
								disabled={!hasChanges || updateSettingMutation.isPending}
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
					</div>
				</Form>
			</CardContent>
		</Card>
	);
}
