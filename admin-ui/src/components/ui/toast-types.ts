import { cva, type VariantProps } from "class-variance-authority";

const toastContainerVariants = cva(
	"fixed p-[1px] rounded-lg shadow-lg dark:shadow-xl not-prose pointer-events-auto will-change-transform",
	{
		variants: {
			position: {
				"top-left": "top-4 left-4 max-w-sm w-full",
				"top-center":
					"top-4 left-1/2 transform -translate-x-1/2 max-w-sm w-full",
				"top-right": "top-4 right-4 max-w-sm w-full",
				"bottom-left": "bottom-4 left-4 max-w-sm w-full",
				"bottom-center":
					"bottom-4 left-1/2 transform -translate-x-1/2 max-w-sm w-full",
				"bottom-right": "bottom-4 right-4 max-w-sm w-full",
			},
			variant: {
				default:
					"bg-linear-to-b from-nocta-200 dark:from-nocta-600/50 to-transparent",
				success:
					"bg-linear-to-b from-green-200 dark:from-green-600/50 to-transparent",
				warning:
					"bg-linear-to-b from-yellow-200 dark:from-yellow-600/50 to-transparent",
				destructive:
					"bg-linear-to-b from-red-200 dark:from-red-600/50 to-transparent",
			},
		},
		defaultVariants: {
			position: "bottom-center",
			variant: "default",
		},
	},
);

export type ToastPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export interface ToastData extends VariantProps<typeof toastContainerVariants> {
	id: string;
	title?: string;
	description?: string;
	className?: string;
	duration?: number;
	action?: {
		label: string;
		onClick: () => void;
	};
	onClose?: () => void;
	shouldClose?: boolean;
}

export { toastContainerVariants };
