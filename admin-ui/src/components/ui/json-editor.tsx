import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy, RotateCcw } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const jsonEditorVariants = cva(
	[
		"w-full h-120 rounded-lg border transition-all duration-200 ease-in-out",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
		"focus-visible:ring-offset-white/50 dark:focus-visible:ring-offset-nocta-900/50",
		"disabled:opacity-50 disabled:cursor-not-allowed",
		"placeholder:text-nocta-400 dark:placeholder:text-nocta-500",
		"font-mono resize-none",
		"not-prose",
	],
	{
		variants: {
			variant: {
				default: [
					"border-nocta-300 dark:border-nocta-800/80",
					"bg-white dark:bg-nocta-950",
					"text-nocta-900 dark:text-nocta-100",
					"hover:border-nocta-300/50 dark:hover:border-nocta-600/50",
					"focus-visible:border-nocta-900/50 dark:focus-visible:border-nocta-100/50",
					"focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
				],
				error: [
					"border-red-300 dark:border-red-700/50",
					"bg-white dark:bg-nocta-950",
					"text-nocta-900 dark:text-nocta-100",
					"hover:border-red-400/50 dark:hover:border-red-600/50",
					"focus-visible:border-red-500/50 dark:focus-visible:border-red-500/50",
					"focus-visible:ring-red-500/50 dark:focus-visible:ring-red-500/50",
				],
				success: [
					"border-green-300 dark:border-green-700/50",
					"bg-white dark:bg-nocta-950",
					"text-nocta-900 dark:text-nocta-100",
					"hover:border-green-400/50 dark:hover:border-green-600/50",
					"focus-visible:border-green-500/50 dark:focus-visible:border-green-500/50",
					"focus-visible:ring-green-500/50 dark:focus-visible:ring-green-500/50",
				],
			},
			size: {
				sm: "px-3 py-2 text-sm",
				md: "px-3 py-2.5 text-sm",
				lg: "px-4 py-3 text-base",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
		},
	},
);

const messageVariants = cva("mt-1.5 text-sm", {
	variants: {
		type: {
			error: "text-red-600 dark:text-red-400",
			success: "text-green-600 dark:text-green-400",
			helper: "text-nocta-600 dark:text-nocta-400",
		},
	},
});

const labelVariants = cva("block text-sm font-medium mb-1.5", {
	variants: {
		variant: {
			default: "text-nocta-700 dark:text-nocta-300",
			error: "text-nocta-700 dark:text-nocta-300",
			success: "text-nocta-700 dark:text-nocta-300",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export interface JsonEditorProps
	extends Omit<
			React.TextareaHTMLAttributes<HTMLTextAreaElement>,
			"size" | "onChange"
		>,
		VariantProps<typeof jsonEditorVariants> {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	helperText?: string;
	errorMessage?: string;
	successMessage?: string;
	containerClassName?: string;
	showToolbar?: boolean;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
	value,
	onChange,
	variant = "default",
	size = "md",
	label,
	helperText,
	errorMessage,
	successMessage,
	className = "",
	containerClassName = "",
	showToolbar = true,
	placeholder = "Enter JSON data...",
	rows = 6,
	disabled = false,
	readOnly = false,
	...props
}) => {
	const [isValid, setIsValid] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isFormatted, setIsFormatted] = useState(false);

	const [copied, setCopied] = useState(false);

	// Validate JSON
	const validateJson = useCallback((jsonString: string) => {
		if (!jsonString.trim()) {
			setIsValid(true);
			setError(null);
			return;
		}

		try {
			JSON.parse(jsonString);
			setIsValid(true);
			setError(null);
		} catch (err) {
			setIsValid(false);
			setError(err instanceof Error ? err.message : "Invalid JSON");
		}
	}, []);

	// Format JSON
	const formatJson = useCallback(() => {
		if (!value.trim()) return;

		try {
			const parsed = JSON.parse(value);
			const formatted = JSON.stringify(parsed, null, 2);
			onChange(formatted);
			setIsFormatted(true);
			setTimeout(() => setIsFormatted(false), 2000);
		} catch (err) {
			// Don't format if invalid
		}
	}, [value, onChange]);

	// Copy to clipboard
	const copyToClipboard = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	}, [value]);

	// Reset to empty
	const resetJson = useCallback(() => {
		onChange("");
	}, [onChange]);

	// Handle input change
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const newValue = e.target.value;
			onChange(newValue);
			validateJson(newValue);
		},
		[onChange, validateJson],
	);

	// Validate on value change
	useEffect(() => {
		validateJson(value);
	}, [value, validateJson]);



	// Determine the effective variant
	const effectiveVariant = !isValid
		? "error"
		: isValid && value.trim()
			? "success"
			: variant;
	const displayErrorMessage =
		(variant === "error" && errorMessage) || (!isValid && error);
	const displaySuccessMessage = variant === "success" && successMessage;

	return (
		<div className={cn("not-prose", containerClassName)}>
			{label && (
				<label className={labelVariants({ variant: effectiveVariant })}>
					{label}
				</label>
			)}

			{showToolbar && (
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-nocta-600 dark:text-nocta-400">
							JSON Editor
						</span>
						{!isValid && (
							<span className="text-xs text-red-600 dark:text-red-400">
								Invalid
							</span>
						)}
						{isValid && value.trim() && (
							<span className="text-xs text-green-600 dark:text-green-400">
								Valid
							</span>
						)}
					</div>
					<div className="flex items-center gap-1">

						<Button
							type="button"
							variant="icon"
							size="sm"
							onClick={formatJson}
							disabled={!isValid || readOnly || !value.trim()}
							className={cn(
								"transition-opacity duration-200",
								!value.trim() && "opacity-30 pointer-events-none",
							)}
						>
							{isFormatted ? (
								<Check className="w-4 h-4 text-green-600 dark:text-green-400" />
							) : (
								"{ }"
							)}
						</Button>
						<Button
							type="button"
							variant="icon"
							size="sm"
							onClick={copyToClipboard}
							disabled={!value.trim()}
							className={cn(
								"transition-opacity duration-200",
								!value.trim() && "opacity-30 pointer-events-none",
							)}
						>
							{copied ? (
								<Check className="w-4 h-4 text-green-600 dark:text-green-400" />
							) : (
								<Copy className="w-4 h-4" />
							)}
						</Button>
						<Button
							type="button"
							variant="icon"
							size="sm"
							onClick={resetJson}
							disabled={readOnly || !value.trim()}
							className={cn(
								"transition-opacity duration-200",
								!value.trim() && "opacity-30 pointer-events-none",
							)}
						>
							<RotateCcw className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}

			<textarea
				value={value}
				onChange={handleChange}
				placeholder={placeholder}
				rows={rows}
				disabled={disabled}
				readOnly={readOnly}
				className={cn(
					jsonEditorVariants({ variant: effectiveVariant, size }),
					className,
				)}
				{...props}
			/>

			{displayErrorMessage && (
				<p className={messageVariants({ type: "error" })}>
					{errorMessage || error}
				</p>
			)}

			{!displayErrorMessage && displaySuccessMessage && (
				<p className={messageVariants({ type: "success" })}>{successMessage}</p>
			)}

			{helperText && !displayErrorMessage && !displaySuccessMessage && (
				<p className={messageVariants({ type: "helper" })}>{helperText}</p>
			)}


		</div>
	);
};
