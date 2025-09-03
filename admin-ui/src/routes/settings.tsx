import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ApiSettingsPanel } from "@/components/settings/ApiSettingsPanel";
import { AuthSettingsPanel } from "@/components/settings/AuthSettingsPanel";
import { DatabaseSettingsPanel } from "@/components/settings/DatabaseSettingsPanel";
import { EmailSettingsPanel } from "@/components/settings/EmailSettingsPanel";
import { OAuthSettingsPanel } from "@/components/settings/OAuthSettingsPanel";
import { SecuritySettingsPanel } from "@/components/settings/SecuritySettingsPanel";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { StorageSettingsPanel } from "@/components/settings/StorageSettingsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllSettings } from "@/hooks/";

function SettingsPage() {
	const { data: allSettings } = useAllSettings();
	const [activeTab, setActiveTab] = useState("database");

	const totalSettings = allSettings?.length || 0;

	return (
		<div className="space-y-4">
			<SettingsHeader totalSettings={totalSettings} />

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-7">
					<TabsTrigger value="database">Database</TabsTrigger>
					<TabsTrigger value="auth">Authentication</TabsTrigger>
					<TabsTrigger value="api">API</TabsTrigger>
					<TabsTrigger value="email">Email</TabsTrigger>
					<TabsTrigger value="oauth">OAuth</TabsTrigger>
					<TabsTrigger value="storage">Storage</TabsTrigger>
					<TabsTrigger value="security">Security</TabsTrigger>
				</TabsList>

				<TabsContent value="database" className="mt-6">
					<DatabaseSettingsPanel />
				</TabsContent>

				<TabsContent value="auth" className="mt-6">
					<AuthSettingsPanel />
				</TabsContent>

				<TabsContent value="api" className="mt-6">
					<ApiSettingsPanel />
				</TabsContent>

				<TabsContent value="email" className="mt-6">
					<EmailSettingsPanel />
				</TabsContent>

				<TabsContent value="oauth" className="mt-6">
					<OAuthSettingsPanel />
				</TabsContent>

				<TabsContent value="storage" className="mt-6">
					<StorageSettingsPanel />
				</TabsContent>

				<TabsContent value="security" className="mt-6">
					<SecuritySettingsPanel />
				</TabsContent>
			</Tabs>
		</div>
	);
}

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});
