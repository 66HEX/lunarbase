import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface BroadcastDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	message: string;
	onMessageChange: (message: string) => void;
	onBroadcast: () => void;
	isBroadcasting: boolean;
}

export function BroadcastDialog({
	open,
	onOpenChange,
	message,
	onMessageChange,
	onBroadcast,
	isBroadcasting,
}: BroadcastDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg" className="min-w-120">
				<DialogHeader>
					<DialogTitle>Broadcast Message</DialogTitle>
					<DialogDescription>
						Send a message to all active WebSocket connections.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="px-4 py-4">
						<Textarea
							placeholder="Enter your broadcast message..."
							value={message}
							onChange={(e) => onMessageChange(e.target.value)}
							rows={4}
							className="mt-1"
						/>
					</div>
				</div>
				<DialogFooter>
					<DialogActions>
						<DialogClose asChild>
							<Button variant="ghost">Cancel</Button>
						</DialogClose>
						<Button
							variant="primary"
							onClick={onBroadcast}
							disabled={isBroadcasting || !message.trim()}
						>
							{isBroadcasting ? (
								<>
									<Spinner className="mr-2 h-4 w-4" />
									Broadcasting...
								</>
							) : (
								<>Send Message</>
							)}
						</Button>
					</DialogActions>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
