import { FloppyDiskIcon } from "@phosphor-icons/react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useSettingsByCategory, useUpdateSetting } from "@/hooks";
import { createUpdateSettingSchema } from "./validation";

export function SecuritySettingsPanel() {
	const { data: settings, isLoading } =
		useSettingsByCategory("security_headers");
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

	const getSettingValue = (key: string): string => {
		return localSettings[key] || "";
	};

	const handleInputChange = (key: string, value: string) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	const handleSwitchChange = (key: string, checked: boolean) => {
		setLocalSettings((prev) => ({ ...prev, [key]: checked.toString() }));
		setHasChanges(true);
	};

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
						category: "security_headers",
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

	if (!settings || !Array.isArray(settings)) {
		return (
			<Card>
				<CardContent className="text-center py-8">
					<p className="text-muted-foreground">No security settings found.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Security Headers Settings
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
						{/* General Security Headers */}
						<FormField className="w-96" name="enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable Security Headers</FormLabel>
									<FormDescription>
										Enable all security headers for enhanced protection
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("enabled") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						{/* HSTS Configuration */}
						<FormField className="w-96" name="hsts_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable HSTS</FormLabel>
									<FormDescription>
										Force HTTPS connections for enhanced security
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("hsts_enabled") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("hsts_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="hsts_max_age">
							<FormLabel>HSTS Max Age (seconds)</FormLabel>
							<FormControl>
								<Input
									type="number"
									value={getSettingValue("hsts_max_age")}
									onChange={(e) =>
										handleInputChange("hsts_max_age", e.target.value)
									}
									placeholder="31536000"
									className="w-72"
								/>
							</FormControl>
							<FormDescription>
								Time in seconds to remember HSTS policy (default: 1 year)
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="hsts_include_subdomains">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Include Subdomains</FormLabel>
									<FormDescription>
										Apply HSTS policy to all subdomains
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={
											getSettingValue("hsts_include_subdomains") === "true"
										}
										onCheckedChange={(checked) =>
											handleSwitchChange("hsts_include_subdomains", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="hsts_preload">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>HSTS Preload</FormLabel>
									<FormDescription>
										Submit domain to browser preload lists
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("hsts_preload") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("hsts_preload", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						{/* Content Security Policy */}
						<FormField className="w-96" name="csp_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Enable CSP</FormLabel>
									<FormDescription>
										Prevent XSS and data injection attacks
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("csp_enabled") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("csp_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="csp_policy">
							<FormLabel>CSP Policy</FormLabel>
							<FormControl>
								<Textarea
									value={getSettingValue("csp_policy")}
									onChange={(e) =>
										handleInputChange("csp_policy", e.target.value)
									}
									placeholder="default-src 'self'; img-src 'self' data:"
									rows={3}
									className="w-72"
								/>
							</FormControl>
							<FormDescription>
								Define allowed sources for content loading
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="csp_report_only">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>CSP Report Only Mode</FormLabel>
									<FormDescription>
										Report violations without blocking content
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("csp_report_only") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("csp_report_only", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						{/* Other Security Headers */}
						<FormField className="w-96" name="content_type_options">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>X-Content-Type-Options</FormLabel>
									<FormDescription>Prevent MIME type sniffing</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("content_type_options") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("content_type_options", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="xss_protection">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>X-XSS-Protection</FormLabel>
									<FormDescription>
										Enable browser XSS filtering
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={getSettingValue("xss_protection") === "true"}
										onCheckedChange={(checked) =>
											handleSwitchChange("xss_protection", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="frame_options_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>X-Frame-Options</FormLabel>
									<FormDescription>
										Prevent clickjacking attacks
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={
											getSettingValue("frame_options_enabled") === "true"
										}
										onCheckedChange={(checked) =>
											handleSwitchChange("frame_options_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="frame_options_policy">
							<FormLabel>X-Frame-Options Value</FormLabel>
							<FormControl>
								<Input
									value={getSettingValue("frame_options_policy")}
									onChange={(e) =>
										handleInputChange("frame_options_policy", e.target.value)
									}
									placeholder="DENY"
									className="w-72"
								/>
							</FormControl>
							<FormDescription>
								Frame options policy value (DENY, SAMEORIGIN, ALLOW-FROM)
							</FormDescription>
						</FormField>

						<FormField className="w-96" name="referrer_policy_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Referrer Policy</FormLabel>
									<FormDescription>
										Control referrer information sent
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={
											getSettingValue("referrer_policy_enabled") === "true"
										}
										onCheckedChange={(checked) =>
											handleSwitchChange("referrer_policy_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="referrer_policy">
							<FormLabel>Referrer Policy Value</FormLabel>
							<FormControl>
								<Input
									value={getSettingValue("referrer_policy")}
									onChange={(e) =>
										handleInputChange("referrer_policy", e.target.value)
									}
									placeholder="strict-origin-when-cross-origin"
									className="w-72"
								/>
							</FormControl>
							<FormDescription>Referrer policy value</FormDescription>
						</FormField>

						<FormField className="w-96" name="permissions_policy_enabled">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<FormLabel>Permissions Policy</FormLabel>
									<FormDescription>
										Control browser feature access
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={
											getSettingValue("permissions_policy_enabled") === "true"
										}
										onCheckedChange={(checked) =>
											handleSwitchChange("permissions_policy_enabled", checked)
										}
									/>
								</FormControl>
							</div>
						</FormField>

						<FormField className="w-96" name="permissions_policy">
							<FormLabel>Permissions Policy Value</FormLabel>
							<FormControl>
								<Textarea
									value={getSettingValue("permissions_policy")}
									onChange={(e) =>
										handleInputChange("permissions_policy", e.target.value)
									}
									placeholder="geolocation=(), microphone=(), camera=()"
									rows={2}
									className="w-72"
								/>
							</FormControl>
							<FormDescription>Permissions policy directives</FormDescription>
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
