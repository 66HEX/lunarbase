"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/lib/utils";

const hasBackgroundColor = (className: string = "") => {
	return /bg-(?!linear|gradient|none)\w+/.test(className);
};

const badgeVariants = cva(
	[
		"inline-flex items-center justify-center rounded-full font-medium",
		"transition-all duration-200 ease-in-out",
		"whitespace-nowrap",
		"not-prose",
	],
	{
		variants: {
			variant: {
				default: [
					"bg-linear-to-b from-nocta-900 to-nocta-700 dark:from-white dark:to-nocta-300",
					"hover:bg-nocta-900 dark:hover:bg-nocta-200",
					"text-nocta-50 dark:text-nocta-900",
				],
				secondary: [
					"bg-nocta-100 dark:bg-nocta-800/50",
					"text-nocta-900 dark:text-nocta-100",
					"hover:bg-nocta-200 dark:hover:bg-nocta-800",
				],
				destructive: [
					"bg-red-500 dark:bg-red-600/50",
					"text-nocta-50 dark:text-nocta-50",
					"hover:bg-red-600 dark:hover:bg-red-700",
				],
				success: [
					"bg-green-500 dark:bg-green-600/50",
					"text-nocta-50 dark:text-nocta-50",
					"hover:bg-green-600 dark:hover:bg-green-700",
				],
				warning: [
					"bg-yellow-500 dark:bg-yellow-600/50",
					"text-nocta-50 dark:text-nocta-50",
					"hover:bg-yellow-600 dark:hover:bg-yellow-700",
				],
				outline: [
					"bg-transparent",
					"text-nocta-900 dark:text-nocta-100",
					"border border-nocta-300 dark:border-nocta-800/50",
					"hover:bg-nocta-50 dark:hover:bg-nocta-900",
				],
			},
			size: {
				sm: "px-2 py-0.5 text-xs",
				md: "px-2.5 py-1 text-xs",
				lg: "px-3 py-1.5 text-sm",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {
	children: React.ReactNode;
	className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
	children,
	variant = "default",
	size = "md",
	className = "",
	...props
}) => {
	const shouldOverrideBackground = hasBackgroundColor(className);

	const getVariantClasses = () => {
		if (shouldOverrideBackground && variant === "default") {
			return badgeVariants({ variant: "default", size })
				.replace(
					/bg-linear-to-b from-nocta-900 to-nocta-700 dark:from-white dark:to-nocta-300/g,
					"",
				)
				.replace(/hover:bg-nocta-900 dark:hover:bg-nocta-200/g, "");
		}
		return badgeVariants({ variant, size });
	};

	return (
		<span className={cn(getVariantClasses(), className)} {...props}>
			{children}
		</span>
	);
};
