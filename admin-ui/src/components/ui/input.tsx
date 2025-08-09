import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/lib/utils";

const inputVariants = cva(
	[
		"relative w-fit rounded-lg border transition-all duration-200 ease-in-out",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
		"focus-visible:ring-offset-white/50 dark:focus-visible:ring-offset-nocta-900/50",
		"disabled:opacity-50 disabled:cursor-not-allowed",
		"placeholder:text-nocta-400 dark:placeholder:text-nocta-500",
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
				sm: "px-3 py-1.5 text-sm",
				md: "px-3 py-2 text-sm",
				lg: "px-4 py-3 text-base",
			},
			hasLeftIcon: {
				true: "pl-10",
				false: "",
			},
			hasRightIcon: {
				true: "pr-10",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
			hasLeftIcon: false,
			hasRightIcon: false,
		},
	},
);

const iconVariants = cva(
	[
		"absolute top-1/2 transform -translate-y-1/2",
		"text-nocta-400 dark:text-nocta-500",
	],
	{
		variants: {
			position: {
				left: "left-3",
				right: "right-3",
			},
			size: {
				sm: "w-4 h-4",
				md: "w-4 h-4",
				lg: "w-5 h-5",
			},
			disabled: {
				true: "opacity-50",
				false: "",
			},
		},
		defaultVariants: {
			size: "md",
			disabled: false,
		},
	},
);

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

const messageVariants = cva("mt-1.5 text-sm", {
	variants: {
		type: {
			error: "text-red-600 dark:text-red-400",
			success: "text-green-600 dark:text-green-400",
			helper: "text-nocta-600 dark:text-nocta-400",
		},
	},
});

export interface InputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
		VariantProps<typeof inputVariants> {
	label?: string;
	helperText?: string;
	successMessage?: string;
	errorMessage?: string;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	className?: string;
	containerClassName?: string;
}

// ...twój importy bez zmian

export const Input: React.FC<InputProps> = ({
  variant = "default",
  size = "md",
  label,
  helperText,
  successMessage,
  errorMessage,
  leftIcon,
  rightIcon,
  className = "",
  containerClassName = "",
  disabled,
  type,
  ...props
}) => {
  const hasLeftIcon = !!leftIcon;
  const hasRightIcon = !!rightIcon || type === "number"; // dla number dodamy własne strzałki
  const displayErrorMessage = variant === "error" && errorMessage;

  const handleStep = (direction: 1 | -1) => {
    if (disabled) return;
    const current = Number(props.value) || 0;
    props.onChange?.({
      target: { value: String(current + direction) },
    } as any);
  };

  return (
    <div className={`not-prose ${containerClassName}`}>
      {label && <label className={labelVariants({ variant })}>{label}</label>}

      <div className="relative">
        {leftIcon && (
          <div
            className={iconVariants({
              position: "left",
              size,
              disabled: !!disabled,
            })}
          >
            {leftIcon}
          </div>
        )}

        <div className="w-fit relative">
			<input
          type={type}
          className={cn(
            inputVariants({ variant, size, hasLeftIcon, hasRightIcon }),
            type === "number" && [
              "[&::-webkit-inner-spin-button]:appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none",
              "[&::-webkit-inner-spin-button]:m-0",
              "[&::-webkit-outer-spin-button]:m-0",
              "[appearance:textfield]",
              "pr-8", // miejsce na nasze strzałki
            ],
            className
          )}
          disabled={disabled}
          {...props}
        />

        {/* Własne spin buttony tylko dla type="number" */}
        {type === "number" && (
          <div className="absolute right-2 top-0 bottom-0 flex flex-col gap-1.5 justify-center">
            <button
              type="button"
              onClick={() => handleStep(1)}
              className="px-1 text-nocta-400 hover:text-nocta-900 dark:hover:text-nocta-100 disabled:opacity-50"
              disabled={disabled}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 0L9 6H1L5 0Z" fill="currentColor"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className="px-1 text-nocta-400 hover:text-nocta-900 dark:hover:text-nocta-100 disabled:opacity-50"
              disabled={disabled}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 6L1 0H9L5 6Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}


        {rightIcon && type !== "number" && (
          <div
            className={iconVariants({
              position: "right",
              size,
              disabled: !!disabled,
            })}
          >
            {rightIcon}
          </div>
        )}
      </div>
		</div>

      {displayErrorMessage && (
        <p className={messageVariants({ type: "error" })}>{errorMessage}</p>
      )}

      {!displayErrorMessage && successMessage && (
        <p className={messageVariants({ type: "success" })}>{successMessage}</p>
      )}

      {helperText && (
        <p className={messageVariants({ type: "helper" })}>{helperText}</p>
      )}
    </div>
  );
};
