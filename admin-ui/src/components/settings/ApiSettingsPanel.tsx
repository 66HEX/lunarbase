import { AlertTriangle, Plus, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useSettingsByCategory, useUpdateSetting } from "@/hooks";
import type { SystemSetting } from "@/types/api";

export function ApiSettingsPanel() {
	const { data: settings, isLoading } = useSettingsByCategory("api");
	const updateSettingMutation = useUpdateSetting();

	const [localSettings, setLocalSettings] = useState<Record<string, string>>(
		{},
	);
	const [corsOrigins, setCorsOrigins] = useState<string[]>([]);
	const [hasChanges, setHasChanges] = useState(false);

	// Required origins that should not be removable
	const requiredOrigins = useMemo(
		() => ["http://localhost:3000", "http://localhost:5173"],
		[],
	);

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

			// Parse CORS origins and filter out required ones for display
			const corsValue = settingsMap.cors_allowed_origins;
			if (corsValue) {
				try {
					const parsed = JSON.parse(corsValue);
					if (Array.isArray(parsed)) {
						// Only show origins that are not in the required list
						const userOrigins = parsed.filter(
							(origin) => !requiredOrigins.includes(origin),
						);
						setCorsOrigins(userOrigins);
					}
				} catch {
					// If parsing fails, start with empty array
					setCorsOrigins([]);
				}
			}
		}
	}, [settings, requiredOrigins]);

	const getSetting = (key: string): SystemSetting | undefined => {
		return settings && Array.isArray(settings)
			? settings.find((s) => s.setting_key === key)
			: undefined;
	};

	const getSettingValue = (key: string): string => {
		return localSettings[key] || "";
	};

	// Check if setting requires restart
	const requiresRestart = (key: string): boolean => {
		const setting = getSetting(key);
		return setting?.requires_restart || false;
	};

	const handleInputChange = (key: string, value: string) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
		setHasChanges(true);
	};

	const addCorsOrigin = () => {
		setCorsOrigins((prev) => [...prev, ""]);
		setHasChanges(true);
	};

	const removeCorsOrigin = (index: number) => {
		setCorsOrigins((prev) => prev.filter((_, i) => i !== index));
		setHasChanges(true);
	};

	const updateCorsOrigin = (index: number, value: string) => {
		setCorsOrigins((prev) =>
			prev.map((origin, i) => (i === index ? value : origin)),
		);
		setHasChanges(true);
	};

	const handleSave = async () => {
		if (!settings) return;

		// Prepare CORS origins by combining required origins with user-defined ones
		const allCorsOrigins = [
			...requiredOrigins,
			...corsOrigins.filter((origin) => origin.trim()),
		];
		const corsValue = JSON.stringify(allCorsOrigins);

		// Update CORS setting
		const corsUpdated = corsValue !== localSettings.cors_allowed_origins;
		if (corsUpdated) {
			await updateSettingMutation.mutateAsync({
				category: "api",
				settingKey: "cors_allowed_origins",
				data: { setting_value: corsValue },
			});
		}

		// Update other settings
		for (const setting of settings) {
			if (setting.setting_key !== "cors_allowed_origins") {
				const newValue = localSettings[setting.setting_key];
				if (newValue !== setting.setting_value) {
					await updateSettingMutation.mutateAsync({
						category: "api",
						settingKey: setting.setting_key,
						data: { setting_value: newValue },
					});
				}
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
				<CardTitle className="flex items-center gap-2">API Settings</CardTitle>
			</CardHeader>
			<CardContent>
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<div className="space-y-6">
						{/* Rate Limit */}
						<FormField name="rate_limit_requests_per_minute">
							<FormLabel>Rate Limit (requests per minute)</FormLabel>
							<FormControl>
								<Input
									type="number"
									min="1"
									max="10000"
									value={getSettingValue("rate_limit_requests_per_minute")}
									onChange={(e) =>
										handleInputChange(
											"rate_limit_requests_per_minute",
											e.target.value,
										)
									}
									placeholder="100"
									className="w-48"
								/>
							</FormControl>
							<FormDescription>
								{getSetting("rate_limit_requests_per_minute")?.description ||
									"Rate limit requests per minute per IP"}
							</FormDescription>
						</FormField>

						{/* CORS Allowed Origins */}
						<FormField name="cors_allowed_origins">
							<div className="flex items-center gap-2">
								<FormLabel>CORS Allowed Origins</FormLabel>
								{requiresRestart("cors_allowed_origins") && (
									<Badge
										size="sm"
										variant="destructive"
										className="flex items-center gap-1 text-xs"
									>
										<AlertTriangle className="w-3 h-3" />
										Restart Required
									</Badge>
								)}
							</div>
							<FormDescription className="mb-3">
								{getSetting("cors_allowed_origins")?.description ||
									"Additional CORS allowed origins (localhost origins are automatically included)"}
							</FormDescription>
							<div className="space-y-2">
								{corsOrigins.map((origin, index) => (
									<div key={index} className="flex items-center gap-2">
										<Input
											type="url"
											value={origin}
											onChange={(e) => updateCorsOrigin(index, e.target.value)}
											placeholder="https://yourdomain.com"
											className="w-72"
										/>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => removeCorsOrigin(index)}
											className="px-2"
										>
											<X className="w-4 h-4" />
										</Button>
									</div>
								))}
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={addCorsOrigin}
									className="flex items-center gap-2"
								>
									<Plus className="w-4 h-4" />
									Add Origin
								</Button>
							</div>
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
