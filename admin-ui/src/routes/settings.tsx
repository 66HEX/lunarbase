import { createFileRoute } from "@tanstack/react-router";
import {
	Bell,
	Clock,
	Database,
	Globe,
	HardDrive,
	Info,
	Monitor,
	RotateCcw,
	Save,
	Server,
	Shield,
	Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { CustomApiError } from "@/lib/api";

interface DatabaseSettings {
	max_connections: number;
	connection_timeout: number;
	query_timeout: number;
	backup_enabled: boolean;
	backup_interval: string;
	backup_retention_days: number;
	auto_vacuum: boolean;
	wal_mode: boolean;
}

interface SecuritySettings {
	jwt_expiry_hours: number;
	password_min_length: number;
	require_uppercase: boolean;
	require_lowercase: boolean;
	require_numbers: boolean;
	require_symbols: boolean;
	max_login_attempts: number;
	lockout_duration_minutes: number;
	two_factor_enabled: boolean;
	session_timeout_minutes: number;
}

interface ApiSettings {
	rate_limit_enabled: boolean;
	rate_limit_requests_per_minute: number;
	cors_enabled: boolean;
	cors_origins: string[];
	api_key_required: boolean;
	request_logging: boolean;
	response_compression: boolean;
	max_request_size_mb: number;
}

interface NotificationSettings {
	email_enabled: boolean;
	smtp_host: string;
	smtp_port: number;
	smtp_username: string;
	smtp_password: string;
	smtp_tls: boolean;
	admin_email: string;
	error_notifications: boolean;
	backup_notifications: boolean;
	security_notifications: boolean;
}

interface SystemInfo {
	version: string;
	rust_version: string;
	database_size: string;
	uptime: string;
	memory_usage: string;
	cpu_usage: string;
	disk_usage: string;
	active_connections: number;
}

// Mock data for demonstration
const mockDatabaseSettings: DatabaseSettings = {
	max_connections: 100,
	connection_timeout: 30,
	query_timeout: 60,
	backup_enabled: true,
	backup_interval: "daily",
	backup_retention_days: 30,
	auto_vacuum: true,
	wal_mode: true,
};

const mockSecuritySettings: SecuritySettings = {
	jwt_expiry_hours: 24,
	password_min_length: 8,
	require_uppercase: true,
	require_lowercase: true,
	require_numbers: true,
	require_symbols: false,
	max_login_attempts: 5,
	lockout_duration_minutes: 15,
	two_factor_enabled: false,
	session_timeout_minutes: 60,
};

const mockApiSettings: ApiSettings = {
	rate_limit_enabled: true,
	rate_limit_requests_per_minute: 100,
	cors_enabled: true,
	cors_origins: ["http://localhost:3000", "https://app.lunarbase.dev"],
	api_key_required: false,
	request_logging: true,
	response_compression: true,
	max_request_size_mb: 10,
};

const mockNotificationSettings: NotificationSettings = {
	email_enabled: false,
	smtp_host: "",
	smtp_port: 587,
	smtp_username: "",
	smtp_password: "",
	smtp_tls: true,
	admin_email: "admin@lunarbase.dev",
	error_notifications: true,
	backup_notifications: true,
	security_notifications: true,
};

const mockSystemInfo: SystemInfo = {
	version: "0.1.0",
	rust_version: "1.75.0",
	database_size: "45.2 MB",
	uptime: "2d 14h 32m",
	memory_usage: "128 MB",
	cpu_usage: "2.3%",
	disk_usage: "1.2 GB",
	active_connections: 3,
};

export default function SettingsComponent() {
	const [databaseSettings, setDatabaseSettings] =
		useState<DatabaseSettings>(mockDatabaseSettings);
	const [securitySettings, setSecuritySettings] =
		useState<SecuritySettings>(mockSecuritySettings);
	const [apiSettings, setApiSettings] = useState<ApiSettings>(mockApiSettings);
	const [notificationSettings, setNotificationSettings] =
		useState<NotificationSettings>(mockNotificationSettings);
	const [systemInfo, setSystemInfo] = useState<SystemInfo>(mockSystemInfo);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [, setError] = useState<string | null>(null);
	const { toast } = useToast();

	useEffect(() => {
		fetchSettings();
	}, []);

	const fetchSettings = async () => {
		try {
			setError(null);

			// In real app, these would be API calls
			// const [dbSettings, secSettings, apiSettings, notifSettings, sysInfo] = await Promise.all([
			//   settingsApi.getDatabaseSettings(),
			//   settingsApi.getSecuritySettings(),
			//   settingsApi.getApiSettings(),
			//   settingsApi.getNotificationSettings(),
			//   settingsApi.getSystemInfo()
			// ]);

			// For now, using mock data
			await new Promise((resolve) => setTimeout(resolve, 1000));

			setDatabaseSettings(mockDatabaseSettings);
			setSecuritySettings(mockSecuritySettings);
			setApiSettings(mockApiSettings);
			setNotificationSettings(mockNotificationSettings);
			setSystemInfo(mockSystemInfo);
		} catch (error) {
			setError(
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch settings",
			);
		} finally {
			setLoading(false);
		}
	};

	const saveSettings = async (category: string) => {
		setSaving(true);
		setError(null);

		try {
			// In real app: await settingsApi.updateSettings(category, settings);
			await new Promise((resolve) => setTimeout(resolve, 1000));

			toast({
				title: "Settings saved",
				position: "bottom-center",
				description: `Settings ${category} saved successfully.`,
				variant: "success",
				duration: 3000,
			});
		} catch (error) {
			const errorMessage =
				error instanceof CustomApiError
					? error.message
					: `Failed to save ${category} settings`;
			setError(errorMessage);
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 5000,
			});
		} finally {
			setSaving(false);
		}
	};

	const handleCorsOriginAdd = () => {
		const newOrigin = prompt("Enter CORS origin:");
		if (newOrigin && !apiSettings.cors_origins.includes(newOrigin)) {
			setApiSettings((prev) => ({
				...prev,
				cors_origins: [...prev.cors_origins, newOrigin],
			}));
		}
	};

	const handleCorsOriginRemove = (origin: string) => {
		setApiSettings((prev) => ({
			...prev,
			cors_origins: prev.cors_origins.filter((o) => o !== origin),
		}));
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading settings...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-1">
				<div className="flex items-center gap-3">
					<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
						Settings
					</h1>
					<Badge variant="outline" className="px-2 py-0.5 text-xs font-medium">
						v{systemInfo.version}
					</Badge>
				</div>
				<p className="text-lg text-nocta-600 dark:text-nocta-400">
					Configure LunarBase system settings and preferences
				</p>
			</div>

			<Tabs defaultValue="system" className="space-y-6">
				<TabsList className="grid w-full max-w-2xl grid-cols-5">
					<TabsTrigger value="system" className="flex items-center gap-2">
						<Monitor className="w-4 h-4" />
						System
					</TabsTrigger>
					<TabsTrigger value="database" className="flex items-center gap-2">
						<Database className="w-4 h-4" />
						Database
					</TabsTrigger>
					<TabsTrigger value="security" className="flex items-center gap-2">
						<Shield className="w-4 h-4" />
						Security
					</TabsTrigger>
					<TabsTrigger value="api" className="flex items-center gap-2">
						<Globe className="w-4 h-4" />
						API
					</TabsTrigger>
					<TabsTrigger
						value="notifications"
						className="flex items-center gap-2"
					>
						<Bell className="w-4 h-4" />
						Notifications
					</TabsTrigger>
				</TabsList>

				{/* System Info Tab */}
				<TabsContent value="system" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Server className="w-5 h-5" />
								System Information
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="p-4 rounded-lg bg-nocta-50 dark:bg-nocta-800/30">
									<div className="flex items-center gap-2 mb-2">
										<Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
										<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Version
										</span>
									</div>
									<p className="text-lg font-bold text-nocta-900 dark:text-nocta-100">
										{systemInfo.version}
									</p>
									<p className="text-xs text-nocta-500 dark:text-nocta-500">
										Rust {systemInfo.rust_version}
									</p>
								</div>

								<div className="p-4 rounded-lg bg-nocta-50 dark:bg-nocta-800/30">
									<div className="flex items-center gap-2 mb-2">
										<Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
										<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Uptime
										</span>
									</div>
									<p className="text-lg font-bold text-nocta-900 dark:text-nocta-100">
										{systemInfo.uptime}
									</p>
								</div>

								<div className="p-4 rounded-lg bg-nocta-50 dark:bg-nocta-800/30">
									<div className="flex items-center gap-2 mb-2">
										<HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
										<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Memory
										</span>
									</div>
									<p className="text-lg font-bold text-nocta-900 dark:text-nocta-100">
										{systemInfo.memory_usage}
									</p>
									<p className="text-xs text-nocta-500 dark:text-nocta-500">
										CPU: {systemInfo.cpu_usage}
									</p>
								</div>

								<div className="p-4 rounded-lg bg-nocta-50 dark:bg-nocta-800/30">
									<div className="flex items-center gap-2 mb-2">
										<Wifi className="w-4 h-4 text-orange-600 dark:text-orange-400" />
										<span className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Connections
										</span>
									</div>
									<p className="text-lg font-bold text-nocta-900 dark:text-nocta-100">
										{systemInfo.active_connections}
									</p>
									<p className="text-xs text-nocta-500 dark:text-nocta-500">
										DB: {systemInfo.database_size}
									</p>
								</div>
							</div>

							<div className="flex gap-2">
								<Button variant="secondary" onClick={fetchSettings}>
									<RotateCcw className="w-4 h-4 mr-2" />
									Refresh
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Database Settings Tab */}
				<TabsContent value="database" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="w-5 h-5" />
								Database Configuration
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Max Connections
									</label>
									<Input
										type="number"
										value={databaseSettings.max_connections}
										onChange={(e) =>
											setDatabaseSettings((prev) => ({
												...prev,
												max_connections: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Connection Timeout (seconds)
									</label>
									<Input
										type="number"
										value={databaseSettings.connection_timeout}
										onChange={(e) =>
											setDatabaseSettings((prev) => ({
												...prev,
												connection_timeout: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Query Timeout (seconds)
									</label>
									<Input
										type="number"
										value={databaseSettings.query_timeout}
										onChange={(e) =>
											setDatabaseSettings((prev) => ({
												...prev,
												query_timeout: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Backup Interval
									</label>
									<Select
										value={databaseSettings.backup_interval}
										onValueChange={(value) =>
											setDatabaseSettings((prev) => ({
												...prev,
												backup_interval: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="hourly">Hourly</SelectItem>
											<SelectItem value="daily">Daily</SelectItem>
											<SelectItem value="weekly">Weekly</SelectItem>
											<SelectItem value="monthly">Monthly</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Backup Retention (days)
									</label>
									<Input
										type="number"
										value={databaseSettings.backup_retention_days}
										onChange={(e) =>
											setDatabaseSettings((prev) => ({
												...prev,
												backup_retention_days: parseInt(e.target.value),
											}))
										}
									/>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="backup_enabled"
										checked={databaseSettings.backup_enabled}
										onCheckedChange={(checked) =>
											setDatabaseSettings((prev) => ({
												...prev,
												backup_enabled: !!checked,
											}))
										}
									/>
									<label
										htmlFor="backup_enabled"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable automatic backups
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="auto_vacuum"
										checked={databaseSettings.auto_vacuum}
										onCheckedChange={(checked) =>
											setDatabaseSettings((prev) => ({
												...prev,
												auto_vacuum: !!checked,
											}))
										}
									/>
									<label
										htmlFor="auto_vacuum"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable auto vacuum
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="wal_mode"
										checked={databaseSettings.wal_mode}
										onCheckedChange={(checked) =>
											setDatabaseSettings((prev) => ({
												...prev,
												wal_mode: !!checked,
											}))
										}
									/>
									<label
										htmlFor="wal_mode"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable WAL mode
									</label>
								</div>
							</div>

							<Button
								onClick={() => saveSettings("Database")}
								disabled={saving}
								className="w-full md:w-auto"
							>
								{saving ? (
									<>
										<Spinner className="w-4 h-4 mr-2" />
										Saving...
									</>
								) : (
									<>
										<Save className="w-4 h-4 mr-2" />
										Save Database Settings
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Security Settings Tab */}
				<TabsContent value="security" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Shield className="w-5 h-5" />
								Security Configuration
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										JWT Expiry (hours)
									</label>
									<Input
										type="number"
										value={securitySettings.jwt_expiry_hours}
										onChange={(e) =>
											setSecuritySettings((prev) => ({
												...prev,
												jwt_expiry_hours: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Session Timeout (minutes)
									</label>
									<Input
										type="number"
										value={securitySettings.session_timeout_minutes}
										onChange={(e) =>
											setSecuritySettings((prev) => ({
												...prev,
												session_timeout_minutes: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Password Min Length
									</label>
									<Input
										type="number"
										value={securitySettings.password_min_length}
										onChange={(e) =>
											setSecuritySettings((prev) => ({
												...prev,
												password_min_length: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Max Login Attempts
									</label>
									<Input
										type="number"
										value={securitySettings.max_login_attempts}
										onChange={(e) =>
											setSecuritySettings((prev) => ({
												...prev,
												max_login_attempts: parseInt(e.target.value),
											}))
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Lockout Duration (minutes)
									</label>
									<Input
										type="number"
										value={securitySettings.lockout_duration_minutes}
										onChange={(e) =>
											setSecuritySettings((prev) => ({
												...prev,
												lockout_duration_minutes: parseInt(e.target.value),
											}))
										}
									/>
								</div>
							</div>

							<div className="space-y-4">
								<h4 className="font-medium text-nocta-900 dark:text-nocta-100">
									Password Requirements
								</h4>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="require_uppercase"
											checked={securitySettings.require_uppercase}
											onCheckedChange={(checked) =>
												setSecuritySettings((prev) => ({
													...prev,
													require_uppercase: !!checked,
												}))
											}
										/>
										<label
											htmlFor="require_uppercase"
											className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
										>
											Require uppercase letters
										</label>
									</div>

									<div className="flex items-center space-x-2">
										<Checkbox
											id="require_lowercase"
											checked={securitySettings.require_lowercase}
											onCheckedChange={(checked) =>
												setSecuritySettings((prev) => ({
													...prev,
													require_lowercase: !!checked,
												}))
											}
										/>
										<label
											htmlFor="require_lowercase"
											className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
										>
											Require lowercase letters
										</label>
									</div>

									<div className="flex items-center space-x-2">
										<Checkbox
											id="require_numbers"
											checked={securitySettings.require_numbers}
											onCheckedChange={(checked) =>
												setSecuritySettings((prev) => ({
													...prev,
													require_numbers: !!checked,
												}))
											}
										/>
										<label
											htmlFor="require_numbers"
											className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
										>
											Require numbers
										</label>
									</div>

									<div className="flex items-center space-x-2">
										<Checkbox
											id="require_symbols"
											checked={securitySettings.require_symbols}
											onCheckedChange={(checked) =>
												setSecuritySettings((prev) => ({
													...prev,
													require_symbols: !!checked,
												}))
											}
										/>
										<label
											htmlFor="require_symbols"
											className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
										>
											Require symbols
										</label>
									</div>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="two_factor_enabled"
										checked={securitySettings.two_factor_enabled}
										onCheckedChange={(checked) =>
											setSecuritySettings((prev) => ({
												...prev,
												two_factor_enabled: !!checked,
											}))
										}
									/>
									<label
										htmlFor="two_factor_enabled"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable two-factor authentication
									</label>
								</div>
							</div>

							<Button
								onClick={() => saveSettings("Security")}
								disabled={saving}
								className="w-full md:w-auto"
							>
								{saving ? (
									<>
										<Spinner className="w-4 h-4 mr-2" />
										Saving...
									</>
								) : (
									<>
										<Save className="w-4 h-4 mr-2" />
										Save Security Settings
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* API Settings Tab */}
				<TabsContent value="api" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Globe className="w-5 h-5" />
								API Configuration
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Rate Limit (requests/minute)
									</label>
									<Input
										type="number"
										value={apiSettings.rate_limit_requests_per_minute}
										onChange={(e) =>
											setApiSettings((prev) => ({
												...prev,
												rate_limit_requests_per_minute: parseInt(
													e.target.value,
												),
											}))
										}
										disabled={!apiSettings.rate_limit_enabled}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
										Max Request Size (MB)
									</label>
									<Input
										type="number"
										value={apiSettings.max_request_size_mb}
										onChange={(e) =>
											setApiSettings((prev) => ({
												...prev,
												max_request_size_mb: parseInt(e.target.value),
											}))
										}
									/>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="rate_limit_enabled"
										checked={apiSettings.rate_limit_enabled}
										onCheckedChange={(checked) =>
											setApiSettings((prev) => ({
												...prev,
												rate_limit_enabled: !!checked,
											}))
										}
									/>
									<label
										htmlFor="rate_limit_enabled"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable rate limiting
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="cors_enabled"
										checked={apiSettings.cors_enabled}
										onCheckedChange={(checked) =>
											setApiSettings((prev) => ({
												...prev,
												cors_enabled: !!checked,
											}))
										}
									/>
									<label
										htmlFor="cors_enabled"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable CORS
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="api_key_required"
										checked={apiSettings.api_key_required}
										onCheckedChange={(checked) =>
											setApiSettings((prev) => ({
												...prev,
												api_key_required: !!checked,
											}))
										}
									/>
									<label
										htmlFor="api_key_required"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Require API key
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="request_logging"
										checked={apiSettings.request_logging}
										onCheckedChange={(checked) =>
											setApiSettings((prev) => ({
												...prev,
												request_logging: !!checked,
											}))
										}
									/>
									<label
										htmlFor="request_logging"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable request logging
									</label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="response_compression"
										checked={apiSettings.response_compression}
										onCheckedChange={(checked) =>
											setApiSettings((prev) => ({
												...prev,
												response_compression: !!checked,
											}))
										}
									/>
									<label
										htmlFor="response_compression"
										className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
									>
										Enable response compression
									</label>
								</div>
							</div>

							{apiSettings.cors_enabled && (
								<div className="space-y-4">
									<h4 className="font-medium text-nocta-900 dark:text-nocta-100">
										CORS Origins
									</h4>
									<div className="space-y-2">
										{apiSettings.cors_origins.map((origin, index) => (
											<div key={index} className="flex items-center gap-2">
												<Input value={origin} readOnly className="flex-1" />
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleCorsOriginRemove(origin)}
													className="text-red-600 hover:text-red-700"
												>
													Remove
												</Button>
											</div>
										))}
										<Button variant="secondary" onClick={handleCorsOriginAdd}>
											Add Origin
										</Button>
									</div>
								</div>
							)}

							<Button
								onClick={() => saveSettings("API")}
								disabled={saving}
								className="w-full md:w-auto"
							>
								{saving ? (
									<>
										<Spinner className="w-4 h-4 mr-2" />
										Saving...
									</>
								) : (
									<>
										<Save className="w-4 h-4 mr-2" />
										Save API Settings
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Notifications Settings Tab */}
				<TabsContent value="notifications" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Bell className="w-5 h-5" />
								Notification Configuration
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center space-x-2 mb-6">
								<Checkbox
									id="email_enabled"
									checked={notificationSettings.email_enabled}
									onCheckedChange={(checked) =>
										setNotificationSettings((prev) => ({
											...prev,
											email_enabled: !!checked,
										}))
									}
								/>
								<label
									htmlFor="email_enabled"
									className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
								>
									Enable email notifications
								</label>
							</div>

							{notificationSettings.email_enabled && (
								<>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-2">
											<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
												SMTP Host
											</label>
											<Input
												value={notificationSettings.smtp_host}
												onChange={(e) =>
													setNotificationSettings((prev) => ({
														...prev,
														smtp_host: e.target.value,
													}))
												}
												placeholder="smtp.gmail.com"
											/>
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
												SMTP Port
											</label>
											<Input
												type="number"
												value={notificationSettings.smtp_port}
												onChange={(e) =>
													setNotificationSettings((prev) => ({
														...prev,
														smtp_port: parseInt(e.target.value),
													}))
												}
											/>
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
												SMTP Username
											</label>
											<Input
												value={notificationSettings.smtp_username}
												onChange={(e) =>
													setNotificationSettings((prev) => ({
														...prev,
														smtp_username: e.target.value,
													}))
												}
												placeholder="your-email@gmail.com"
											/>
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
												SMTP Password
											</label>
											<Input
												type="password"
												value={notificationSettings.smtp_password}
												onChange={(e) =>
													setNotificationSettings((prev) => ({
														...prev,
														smtp_password: e.target.value,
													}))
												}
												placeholder="••••••••"
											/>
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
												Admin Email
											</label>
											<Input
												type="email"
												value={notificationSettings.admin_email}
												onChange={(e) =>
													setNotificationSettings((prev) => ({
														...prev,
														admin_email: e.target.value,
													}))
												}
												placeholder="admin@lunarbase.dev"
											/>
										</div>
									</div>

									<div className="flex items-center space-x-2">
										<Checkbox
											id="smtp_tls"
											checked={notificationSettings.smtp_tls}
											onCheckedChange={(checked) =>
												setNotificationSettings((prev) => ({
													...prev,
													smtp_tls: !!checked,
												}))
											}
										/>
										<label
											htmlFor="smtp_tls"
											className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
										>
											Enable TLS/SSL
										</label>
									</div>

									<div className="space-y-4">
										<h4 className="font-medium text-nocta-900 dark:text-nocta-100">
											Notification Types
										</h4>

										<div className="space-y-3">
											<div className="flex items-center space-x-2">
												<Checkbox
													id="error_notifications"
													checked={notificationSettings.error_notifications}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															error_notifications: !!checked,
														}))
													}
												/>
												<label
													htmlFor="error_notifications"
													className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
												>
													Error notifications
												</label>
											</div>

											<div className="flex items-center space-x-2">
												<Checkbox
													id="backup_notifications"
													checked={notificationSettings.backup_notifications}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															backup_notifications: !!checked,
														}))
													}
												/>
												<label
													htmlFor="backup_notifications"
													className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
												>
													Backup notifications
												</label>
											</div>

											<div className="flex items-center space-x-2">
												<Checkbox
													id="security_notifications"
													checked={notificationSettings.security_notifications}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															security_notifications: !!checked,
														}))
													}
												/>
												<label
													htmlFor="security_notifications"
													className="text-sm font-medium text-nocta-700 dark:text-nocta-300"
												>
													Security notifications
												</label>
											</div>
										</div>
									</div>
								</>
							)}

							<Button
								onClick={() => saveSettings("Notifications")}
								disabled={saving}
								className="w-full md:w-auto"
							>
								{saving ? (
									<>
										<Spinner className="w-4 h-4 mr-2" />
										Saving...
									</>
								) : (
									<>
										<Save className="w-4 h-4 mr-2" />
										Save Notification Settings
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});
