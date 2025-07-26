"use client";

import { useContext } from "react";
import { ToastContext } from "@/components/ui/toast-context";

/**
 * Hook to use toast functionality
 *
 * @example
 * const { toast } = useToast();
 *
 * toast({
 *   title: "Success",
 *   description: "Your action was completed",
 *   variant: "success",
 *   position: "top-right", // Optional: defaults to "bottom-center"
 *   duration: 5000, // Optional: defaults to 5000ms
 *   action: { // Optional
 *     label: "Undo",
 *     onClick: () => console.log("Undo clicked")
 *   }
 * });
 */
export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
};
