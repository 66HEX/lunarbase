import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { DatabaseSettingsPanel } from '@/components/settings/DatabaseSettingsPanel';
import { AuthSettingsPanel } from '@/components/settings/AuthSettingsPanel';
import { ApiSettingsPanel } from '@/components/settings/ApiSettingsPanel';
import { useAllSettings } from '@/hooks/configuration/useConfiguration';

function SettingsPage() {
	const { data: allSettings } = useAllSettings();
	const [activeTab, setActiveTab] = useState('database');

	const totalSettings = allSettings?.length || 0;

	return (
		<div className="space-y-4">
			<SettingsHeader totalSettings={totalSettings} />
			
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="database">Database</TabsTrigger>
					<TabsTrigger value="auth">Authentication</TabsTrigger>
					<TabsTrigger value="api">API</TabsTrigger>
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
			</Tabs>
		</div>
	);
}

export const Route = createFileRoute('/settings')({
	component: SettingsPage,
})
