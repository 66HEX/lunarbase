"use client";

import { cva, type VariantProps } from "class-variance-authority";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const selectTriggerVariants = cva(
	`flex w-fit items-center justify-between
   rounded-lg border border-nocta-200 dark:border-nocta-800/50
   bg-nocta-100 dark:bg-nocta-950/80
   hover:border-nocta-300 dark:hover:border-nocta-700/50
   placeholder:text-nocta-400 dark:placeholder:text-nocta-500
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-nocta-50/50 dark:focus-visible:ring-offset-nocta-900/50
   focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50
   focus-visible:border-nocta-900/50 dark:focus-visible:border-nocta-100/50
   disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer
   transition-all duration-200 ease-out shadow-sm
   not-prose`,
	{
		variants: {
			size: {
				sm: "h-8 px-2 text-xs",
				md: "h-10 px-3 text-sm",
				lg: "h-12 px-4 text-base",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

export interface SelectProps {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	children: React.ReactNode;
	size?: "sm" | "md" | "lg";
	portalProps?: React.HTMLAttributes<HTMLDivElement>;
}

export interface SelectTriggerProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof selectTriggerVariants> {
	children: React.ReactNode;
	className?: string;
}

export interface SelectContentProps {
	children: React.ReactNode;
	className?: string;
	position?: "bottom" | "top";
}

export interface SelectItemProps {
	value: string;
	children: React.ReactNode;
	className?: string;
	disabled?: boolean;
}

export interface SelectValueProps {
	placeholder?: string;
	className?: string;
}

let selectIdCounter = 0;
const generateSelectId = () => `select-${++selectIdCounter}`;

const SelectContext = React.createContext<{
	value?: string;
	displayValue?: React.ReactNode;
	onValueChange?: (value: string, displayValue: React.ReactNode) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	triggerRef?: React.RefObject<HTMLButtonElement | null>;
	contentId: string;
	focusedIndex: number;
	setFocusedIndex: (index: number) => void;
	options: Array<{ value: string; disabled: boolean }>;
	setOptions: React.Dispatch<
		React.SetStateAction<Array<{ value: string; disabled: boolean }>>
	>;
	portalProps?: React.HTMLAttributes<HTMLDivElement>;
}>({
	open: false,
	setOpen: () => {},
	contentId: "",
	focusedIndex: -1,
	setFocusedIndex: () => {},
	options: [],
	setOptions: () => {},
});

export const Select: React.FC<SelectProps> = ({
	value: controlledValue,
	defaultValue,
	onValueChange,
	onOpenChange,
	disabled = false,
	children,
	size = "md",
	portalProps,
}) => {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
	const [displayValue, setDisplayValue] = useState<React.ReactNode>(null);
	const [open, setOpenState] = useState(false);

	const setOpen = (newOpen: boolean) => {
		setOpenState(newOpen);
	};
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const [options, setOptions] = useState<
		Array<{ value: string; disabled: boolean }>
	>([]);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [contentId] = useState(() => generateSelectId());

	const value =
		controlledValue !== undefined ? controlledValue : uncontrolledValue;

	useEffect(() => {
		if (open) {
			setFocusedIndex(-1);
		} else {
			setFocusedIndex(-1);
		}
	}, [open]);

	useEffect(() => {
		onOpenChange?.(open);
	}, [open, onOpenChange]);

	useEffect(() => {
		if (value && children) {
			const childrenArray = React.Children.toArray(children);
			const findDisplayValue = (
				children: React.ReactNode[],
			): React.ReactNode => {
				for (const child of children) {
					if (React.isValidElement(child)) {
						if (child.type === SelectContent) {
							const childProps = child.props as { children?: React.ReactNode };
							return findDisplayValue(
								React.Children.toArray(childProps.children),
							);
						} else if (
							child.props &&
							typeof child.props === "object" &&
							child.props !== null &&
							"value" in child.props &&
							child.props.value === value
						) {
							const childProps = child.props as { children?: React.ReactNode };
							return childProps.children;
						} else if (
							child.props &&
							typeof child.props === "object" &&
							child.props !== null &&
							"children" in child.props
						) {
							const childProps = child.props as { children?: React.ReactNode };
							const result = findDisplayValue(
								React.Children.toArray(childProps.children),
							);
							if (result) return result;
						}
					}
				}
				return null;
			};

			const foundDisplayValue = findDisplayValue(childrenArray);
			if (foundDisplayValue) {
				setDisplayValue(foundDisplayValue);
			}
		} else if (!value) {
			setDisplayValue(null);
		}
	}, [value, children]);

	const handleValueChange = (
		newValue: string,
		newDisplayValue: React.ReactNode,
	) => {
		if (controlledValue === undefined) {
			setUncontrolledValue(newValue);
		}
		setDisplayValue(newDisplayValue);
		onValueChange?.(newValue);
		setOpen(false);
		setFocusedIndex(-1);
	};

	return (
		<SelectContext.Provider
			value={{
				value: value,
				displayValue,
				onValueChange: handleValueChange,
				open,
				setOpen,
				disabled,
				size,
				triggerRef,
				contentId,
				focusedIndex,
				setFocusedIndex,
				options,
				setOptions,
				portalProps,
			}}
		>
			<div className="relative not-prose">{children}</div>
		</SelectContext.Provider>
	);
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
	children,
	className = "",
	size: propSize,
	...props
}) => {
	const {
		open,
		setOpen,
		disabled,
		size: contextSize,
		triggerRef,
		contentId,
		options,
		setFocusedIndex,
	} = React.useContext(SelectContext);
	const size = propSize || contextSize || "md";

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (disabled) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				if (!open) {
					setOpen(true);
					setTimeout(() => setFocusedIndex(0), 0);
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (!open) {
					setOpen(true);
					setTimeout(() => setFocusedIndex(Math.max(0, options.length - 1)), 0);
				}
				break;
		}
	};

	return (
		<button
			ref={triggerRef}
			type="button"
			role="combobox"
			aria-expanded={open}
			aria-controls={contentId}
			aria-haspopup="listbox"
			disabled={disabled}
			className={cn(selectTriggerVariants({ size }), className)}
			onClick={() => !disabled && setOpen(!open)}
			onKeyDown={handleKeyDown}
			{...props}
		>
			{children}
			<svg
				className={`ml-2 h-4 w-4 text-nocta-300 shrink-0 opacity-50 transition-transform duration-200 ease-in-out ${
					open ? "rotate-180" : ""
				}`}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M19 9l-7 7-7-7"
				/>
			</svg>
		</button>
	);
};

export const SelectContent: React.FC<SelectContentProps> = ({
	children,
	className = "",
	position = "bottom",
}) => {
	const {
		open,
		setOpen,
		triggerRef,
		contentId,
		focusedIndex,
		setFocusedIndex,
		options,
		onValueChange,
		portalProps,
	} = React.useContext(SelectContext);
	const contentRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0,
		width: 0,
	});
	const [actualPosition, setActualPosition] = useState<"top" | "bottom">(
		position,
	);

	useEffect(() => {
		if (open) {
			setShouldRender(true);

			if (triggerRef?.current) {
				const triggerRect = triggerRef.current.getBoundingClientRect();
				const viewportHeight = window.innerHeight;
				const spaceBelow = viewportHeight - triggerRect.bottom;
				const spaceAbove = triggerRect.top;
				const dropdownHeight = 240;

				let finalPosition: "top" | "bottom" = position;
				if (
					position === "bottom" &&
					spaceBelow < dropdownHeight &&
					spaceAbove > spaceBelow
				) {
					finalPosition = "top";
				} else if (
					position === "top" &&
					spaceAbove < dropdownHeight &&
					spaceBelow > spaceAbove
				) {
					finalPosition = "bottom";
				}

				setActualPosition(finalPosition);
				setDropdownPosition({
					top:
						finalPosition === "bottom"
							? triggerRect.bottom + window.scrollY + 4
							: triggerRect.top + window.scrollY - 4,
					left: triggerRect.left + window.scrollX,
					width: triggerRect.width,
				});
			}

			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					setIsVisible(true);
				});
			});
		} else {
			setIsVisible(false);
			const timer = setTimeout(() => {
				setShouldRender(false);
			}, 200);
			return () => clearTimeout(timer);
		}
	}, [open, position, triggerRef]);

	useEffect(() => {
		const updatePosition = () => {
			if (open && triggerRef?.current) {
				const triggerRect = triggerRef.current.getBoundingClientRect();
				const viewportHeight = window.innerHeight;
				const spaceBelow = viewportHeight - triggerRect.bottom;
				const spaceAbove = triggerRect.top;
				const dropdownHeight = 240;

				let finalPosition: "top" | "bottom" = position;
				if (
					position === "bottom" &&
					spaceBelow < dropdownHeight &&
					spaceAbove > spaceBelow
				) {
					finalPosition = "top";
				} else if (
					position === "top" &&
					spaceAbove < dropdownHeight &&
					spaceBelow > spaceAbove
				) {
					finalPosition = "bottom";
				}

				setActualPosition(finalPosition);
				setDropdownPosition({
					top:
						finalPosition === "bottom"
							? triggerRect.bottom + window.scrollY + 4
							: triggerRect.top + window.scrollY - 4,
					left: triggerRect.left + window.scrollX,
					width: triggerRect.width,
				});
			}
		};

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			const isClickInContent =
				contentRef.current && contentRef.current.contains(target);
			const isClickInTrigger =
				triggerRef?.current && triggerRef.current.contains(target);

			if (!isClickInContent && !isClickInTrigger) {
				setOpen(false);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!open) return;

			switch (event.key) {
				case "Escape":
					event.preventDefault();
					setOpen(false);
					triggerRef?.current?.focus();
					break;
				case "ArrowDown":
					event.preventDefault();
					if (options.length > 0) {
						const nextIndex =
							focusedIndex < options.length - 1 ? focusedIndex + 1 : 0;
						setFocusedIndex(nextIndex);
					}
					break;
				case "ArrowUp":
					event.preventDefault();
					if (options.length > 0) {
						const prevIndex =
							focusedIndex > 0 ? focusedIndex - 1 : options.length - 1;
						setFocusedIndex(prevIndex);
					}
					break;
				case "Enter":
				case " ":
					event.preventDefault();
					if (focusedIndex >= 0 && focusedIndex < options.length) {
						const focusedOption = options[focusedIndex];
						if (!focusedOption.disabled) {
							const childrenArray = React.Children.toArray(children);
							const focusedChild = childrenArray[focusedIndex];
							if (
								React.isValidElement(focusedChild) &&
								focusedChild.props &&
								typeof focusedChild.props === "object" &&
								focusedChild.props !== null &&
								"children" in focusedChild.props
							) {
								const childProps = focusedChild.props as {
									children?: React.ReactNode;
								};
								onValueChange?.(focusedOption.value, childProps.children);
							}
						}
					}
					break;
				case "Home":
					event.preventDefault();
					if (options.length > 0) {
						setFocusedIndex(0);
					}
					break;
				case "End":
					event.preventDefault();
					if (options.length > 0) {
						setFocusedIndex(options.length - 1);
					}
					break;
			}
		};

		if (open) {
			document.addEventListener("mousedown", handleClickOutside);
			document.addEventListener("keydown", handleKeyDown);
			window.addEventListener("scroll", updatePosition, true);
			window.addEventListener("resize", updatePosition);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
		};
	}, [
		open,
		setOpen,
		triggerRef,
		focusedIndex,
		setFocusedIndex,
		options,
		onValueChange,
		children,
		position,
	]);

	if (!shouldRender) return null;

	const animationStyles =
		actualPosition === "bottom"
			? `transform transition-all duration-200 ease-out origin-top ${
					isVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
				}`
			: `transform transition-all duration-200 ease-out origin-bottom ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
				}`;

	const dropdownContent = (
		<div
			{...portalProps}
			ref={contentRef}
			id={contentId}
			role="listbox"
			style={{
				position: "fixed",
				top:
					actualPosition === "bottom"
						? dropdownPosition.top
						: dropdownPosition.top - 240,
				left: dropdownPosition.left,
				width: dropdownPosition.width,
				zIndex: 9999,
			}}
			className={cn(
					"min-w-[8rem] overflow-hidden rounded-lg border border-nocta-200 dark:border-nocta-50/5 bg-nocta-100 dark:bg-[#121212] shadow-lg dark:shadow-xl",
				animationStyles,
				"not-prose",
				className,
				portalProps?.className,
			)}
		>
			<div className="max-h-60 overflow-auto py-1 flex flex-col gap-1">
				{children}
			</div>
		</div>
	);

	return typeof document !== "undefined"
		? createPortal(dropdownContent, document.body)
		: null;
};

export const SelectItem: React.FC<SelectItemProps> = ({
	value,
	children,
	className = "",
	disabled = false,
}) => {
	const {
		value: selectedValue,
		onValueChange,
		options,
		setOptions,
		focusedIndex,
	} = React.useContext(SelectContext);
	const isSelected = selectedValue === value;

	useEffect(() => {
		setOptions((prevOptions) => {
			const newOptions = [...prevOptions];
			const existingIndex = newOptions.findIndex((opt) => opt.value === value);

			if (existingIndex >= 0) {
				newOptions[existingIndex] = { value, disabled };
			} else {
				newOptions.push({ value, disabled });
			}

			return newOptions;
		});

		return () => {
			setOptions((prevOptions) =>
				prevOptions.filter((opt) => opt.value !== value),
			);
		};
	}, [value, disabled, setOptions]);

	const itemIndex = options.findIndex((opt) => opt.value === value);
	const isFocused =
		focusedIndex >= 0 && itemIndex >= 0 && itemIndex === focusedIndex;

	return (
		<div
			role="option"
			aria-selected={isSelected}
			className={cn(
				"relative flex cursor-pointer select-none text-nocta-700 dark:text-nocta-400 items-center px-3 py-2 text-sm outline-none mx-1 rounded-md hover:bg-nocta-100 dark:hover:bg-nocta-900 focus-visible:bg-nocta-100 dark:focus-visible:bg-nocta-800",
				isSelected ? "bg-nocta-100 dark:bg-nocta-900" : "",
				isFocused ? "bg-nocta-100 dark:bg-nocta-900" : "",
				disabled
					? "pointer-events-none opacity-50"
					: "transition-colors duration-150 not-prose",
				className,
			)}
			onClick={() => !disabled && onValueChange?.(value, children)}
		>
			<span className={`flex-1 ${isSelected ? "font-light" : ""}`}>
				{children}
			</span>
			{isSelected && (
				<svg
					className="ml-2 h-4 w-4 text-nocta-600 dark:text-nocta-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M5 13l4 4L19 7"
					/>
				</svg>
			)}
		</div>
	);
};

export const SelectValue: React.FC<SelectValueProps> = ({
	placeholder = "Select an option...",
	className = "",
}) => {
	const { value, displayValue } = React.useContext(SelectContext);

	return (
		<span className={`block text-left w-full text-nocta-900 dark:text-nocta-100 ${className}`}>
			{value ? (
				<span>{displayValue}</span>
			) : (
				<span className="text-nocta-400 dark:text-nocta-500">
					{placeholder}
				</span>
			)}
		</span>
	);
};
