import { FloppyDiskIcon, WarningIcon } from "@phosphor-icons/react";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useSettingsByCategory, useUpdateSetting } from "@/hooks";
import type { SystemSetting } from "@/types/api";
import { createUpdateSettingSchema } from "./validation";

export function OAuthSettingsPanel() {
	const { data: settings, isLoading } = useSettingsByCategory("oauth");
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

	const requiresRestart = (key: string): boolean => {
		const setting = getSetting(key);
		return setting?.requires_restart || false;
	};

	const handleInputChange = (key: string, value: string) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	const handleSwitchChange = (key: string, checked: boolean) => {
		setLocalSettings((prev) => ({ ...prev, [key]: checked.toString() }));
		setHasChanges(true);
	};

	const isOAuthEnabled = getSettingValue("oauth_enabled") === "true";

	const handleSave = async () => {
		if (!settings || !Array.isArray(settings)) return;

		try {
			for (const setting of settings) {
				const newValue = localSettings[setting.setting_key];
				if (newValue !== undefined && newValue !== setting.setting_value) {
					const schema = createUpdateSettingSchema(setting.data_type);
					const result = schema.safeParse({ setting_value: newValue });

					if (!result.success) {
						const errorMessage = result.error.issues
							.map((e: any) => e.message)
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
						category: "oauth",
						settingKey: setting.setting_key,
						data: { setting_value: newValue },
					});
				}
			}
			setHasChanges(false);
		} catch (error) {
			toast({
				title: "Failed to update settings",
				description: error instanceof Error ? error.message : "Unknown error",
				variant: "destructive",
				position: "bottom-right",
			});
		}
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
					OAuth Settings
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
						<FormField className="w-96" name="oauth_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable OAuth</FormLabel>
									<FormDescription>
										{getSetting("oauth_enabled")?.description ||
											"Enable or disable OAuth authentication"}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("oauth_enabled") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("oauth_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="google_client_id">
							<div className="flex items-center gap-2">
								<FormLabel>Google Client ID</FormLabel>
								{requiresRestart("google_client_id") && (
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
									type="text"
									value={getSettingValue("google_client_id")}
									onChange={(e) =>
										handleInputChange("google_client_id", e.target.value)
									}
									placeholder="Enter Google OAuth Client ID"
									className="w-72"
									disabled={!isOAuthEnabled}
								/>
							</FormControl>
							<FormDescription>
								{getSetting("google_client_id")?.description ||
									"Google OAuth 2.0 Client ID for authentication"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="google_client_secret">
							<div className="flex items-center gap-2">
								<FormLabel>Google Client Secret</FormLabel>
								{requiresRestart("google_client_secret") && (
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
									type="password"
									value={getSettingValue("google_client_secret")}
									onChange={(e) =>
										handleInputChange("google_client_secret", e.target.value)
									}
									placeholder="Enter Google OAuth Client Secret"
									className="w-72"
									disabled={!isOAuthEnabled}
								/>
							</FormControl>
							<FormDescription>
								{getSetting("google_client_secret")?.description ||
									"Google OAuth 2.0 Client Secret for authentication"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="github_client_id">
							<FormLabel>GitHub Client ID</FormLabel>
							<FormControl>
								<Input
									type="text"
									value={getSettingValue("github_client_id")}
									onChange={(e) =>
										handleInputChange("github_client_id", e.target.value)
									}
									placeholder="Enter GitHub OAuth Client ID"
									className="w-72"
									disabled={!isOAuthEnabled}
								/>
							</FormControl>
							<FormDescription>
								{getSetting("github_client_id")?.description ||
									"GitHub OAuth Client ID for authentication"}
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="github_client_secret">
							<FormLabel>GitHub Client Secret</FormLabel>
							<FormControl>
								<Input
									type="password"
									value={getSettingValue("github_client_secret")}
									onChange={(e) =>
										handleInputChange("github_client_secret", e.target.value)
									}
									placeholder="Enter GitHub OAuth Client Secret"
									className="w-72"
									disabled={!isOAuthEnabled}
								/>
							</FormControl>
							<FormDescription>
								{getSetting("github_client_secret")?.description ||
									"GitHub OAuth Client Secret for authentication"}
							</FormDescription>
						</FormField>
					</div>

					<div className="flex justify-end pt-6">
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