"use client";

import { createContext } from "react";
import type { ToastData } from "./toast-types";

export interface ToastContextValue {
	toast: (data: Omit<ToastData, "id">) => string;
	dismiss: (id: string) => void;
	dismissAll: () => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(
	undefined,
);
