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

interface DeleteRecordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	onCancel: () => void;
}

export function DeleteRecordDialog({
	open,
	onOpenChange,
	onConfirm,
	onCancel,
}: DeleteRecordDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="sm">
				<DialogHeader>
					<DialogTitle>Delete Record</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this record? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogActions>
						<DialogClose asChild>
							<Button variant="ghost" onClick={onCancel}>
								Cancel
							</Button>
						</DialogClose>
						<Button variant="primary" onClick={onConfirm}>
							Delete
						</Button>
					</DialogActions>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
