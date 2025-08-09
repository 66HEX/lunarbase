import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BroadcastDialog,
	WebSocketActivity,
	WebSocketConnections,
	WebSocketHeader,
	WebSocketStats,
	WebSocketSubscriptions,
} from "@/components/websocket";
import { useToast } from "@/hooks/useToast";
import { useWebSocketData } from "@/hooks/useWebSocketQueries";
import { webSocketApi } from "@/lib/api";
import { useUI, useUIActions } from "@/stores/client.store";
import type { BroadcastMessageRequest } from "@/types/api";

export const Route = createFileRoute("/websocket")({
	component: WebSocketComponent,
});

function WebSocketComponent() {
	const { stats, connections, activity, isLoading, error, refetchAll } =
		useWebSocketData();

	// UI store for modals
	const { modals } = useUI();
	const { openModal, closeModal } = useUIActions();

	const [broadcastMessage, setBroadcastMessage] = useState("");
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const { toast } = useToast();

	const handleBroadcast = async () => {
		if (!broadcastMessage.trim()) {
			toast({
				title: "Error",
				description: "Please enter a message to broadcast",
				variant: "destructive",
			});
			return;
		}

		setIsBroadcasting(true);
		try {
			const request: BroadcastMessageRequest = {
				message: broadcastMessage,
			};
			const response = await webSocketApi.broadcastMessage(request);
			toast({
				title: "Message Broadcast",
				description: `Message sent to ${response.sent_to_connections} connections`,
				variant: "success",
			});
			setBroadcastMessage("");
			closeModal("broadcast");
			refetchAll();
		} catch (error: unknown) {
			toast({
				title: "Broadcast Failed",
				description: (error as Error).message || "Failed to broadcast message",
				variant: "destructive",
			});
		} finally {
			setIsBroadcasting(false);
		}
	};

	const handleDisconnectConnection = async (connectionId: string) => {
		try {
			await webSocketApi.disconnectConnection(connectionId);
			toast({
				title: "Connection Disconnected",
				description: `Connection ${connectionId} has been disconnected`,
				variant: "success",
			});
			refetchAll();
		} catch (error: unknown) {
			toast({
				title: "Disconnect Failed",
				description:
					(error as Error).message || "Failed to disconnect connection",
				variant: "destructive",
			});
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading WebSocket data...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-4">
						<Activity className="w-8 h-8 text-red-600 dark:text-red-400" />
					</div>
					<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
						Error loading WebSocket data
					</h3>
					<p className="text-nocta-600 dark:text-nocta-400 mb-4">
						{error.message || "Something went wrong"}
					</p>
					<Button onClick={() => window.location.reload()}>Try again</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<WebSocketHeader
				activeConnections={stats?.total_connections || 0}
				onRefresh={refetchAll}
				onBroadcast={() => openModal("broadcast")}
				isLoading={isLoading}
			/>

			{/* Stats Cards */}
			<WebSocketStats stats={stats} />

			{/* Main Content Tabs */}
			<Tabs defaultValue="connections" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="connections">Active Connections</TabsTrigger>
					<TabsTrigger value="activity">Recent Activity</TabsTrigger>
					<TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
				</TabsList>
				<TabsContent value="connections" className="mt-4">
					<WebSocketConnections
						connections={connections}
						isLoading={isLoading}
						onDisconnectConnection={handleDisconnectConnection}
					/>
				</TabsContent>
				<TabsContent value="activity" className="mt-4">
					<WebSocketActivity activity={activity} />
				</TabsContent>
				<TabsContent value="subscriptions" className="mt-4">
					{!stats?.subscriptions_by_collection ||
					Object.keys(stats.subscriptions_by_collection).length === 0 ? (
						<Card className="flex items-center justify-center py-12">
							<div className="text-center">
								<Activity className="w-12 h-12 mx-auto mb-4 text-nocta-400 dark:text-nocta-600" />
								<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
									No Active Subscriptions
								</h3>
								<p className="text-nocta-600 dark:text-nocta-400">
									There are currently no active WebSocket subscriptions.
								</p>
							</div>
						</Card>
					) : (
						<WebSocketSubscriptions stats={stats} />
					)}
				</TabsContent>
			</Tabs>

			{/* Broadcast Message Dialog */}
			<BroadcastDialog
				open={modals.broadcast || false}
				onOpenChange={(open) =>
					open ? openModal("broadcast") : closeModal("broadcast")
				}
				message={broadcastMessage}
				onMessageChange={setBroadcastMessage}
				onBroadcast={handleBroadcast}
				isBroadcasting={isBroadcasting}
			/>
		</div>
	);
}
