import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	Radio,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useWebSocketData } from "@/hooks/useWebSocketQueries";
import { webSocketApi } from "@/lib/api";
import type {
	BroadcastMessageRequest,
} from "@/types/api";
import {
	WebSocketStats,
	WebSocketConnections,
	WebSocketActivity,
	WebSocketSubscriptions,
	BroadcastDialog,
} from "@/components/websocket";

export const Route = createFileRoute("/websocket")({
	component: WebSocketComponent,
});

function WebSocketComponent() {
	const {
		stats,
		connections,
		activity,
		isLoading,
		error,
		refetchAll,
	} = useWebSocketData();

	const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
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
			setBroadcastDialogOpen(false);
			refetchAll();
		} catch (error: any) {
			toast({
				title: "Broadcast Failed",
				description: error.message || "Failed to broadcast message",
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
		} catch (error: any) {
			toast({
				title: "Disconnect Failed",
				description: error.message || "Failed to disconnect connection",
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
					<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
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
			<div className="flex items-start justify-between mb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							WebSocket Management
						</h1>
						<Badge
							variant={stats?.total_connections ? "success" : "secondary"}
							className="px-2 py-0.5 text-xs font-medium"
						>
							{stats?.total_connections || 0} active
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Monitor real-time connections and manage WebSocket activity
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={refetchAll}
						disabled={isLoading}
					>
						<RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
					<Button
						className="px-4 py-2"
						onClick={() => setBroadcastDialogOpen(true)}
						disabled={!stats?.total_connections}
					>
						<Radio className="w-4 h-4 mr-2" />
						Broadcast Message
					</Button>
				</div>
			</div>

			{/* Stats Cards */}
			<WebSocketStats stats={stats} />

			{/* Main Content Tabs */}
			<Tabs defaultValue="connections" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="connections">Active Connections</TabsTrigger>
					<TabsTrigger value="activity">Recent Activity</TabsTrigger>
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
			</Tabs>

			{/* Subscription Details */}
			<WebSocketSubscriptions stats={stats} />

			{/* Broadcast Message Dialog */}
			<BroadcastDialog
				open={broadcastDialogOpen}
				onOpenChange={setBroadcastDialogOpen}
				message={broadcastMessage}
				onMessageChange={setBroadcastMessage}
				onBroadcast={handleBroadcast}
				isBroadcasting={isBroadcasting}
			/>
		</div>
	);
}
