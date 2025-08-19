"use client";

import type { ToastData } from "@/components/ui/toast";

type ToastSubscriber = (toasts: ToastData[]) => void;

class ToastState {
	private toasts: ToastData[] = [];
	private subscribers: Set<ToastSubscriber> = new Set();
	private idCounter = 0;

	subscribe(callback: ToastSubscriber): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	private notify(): void {
		this.subscribers.forEach((callback) => callback([...this.toasts]));
	}

	private generateId(): string {
		return `toast-${++this.idCounter}-${Date.now()}`;
	}

	add(data: Omit<ToastData, "id">): string {
		const id = this.generateId();
		this.toasts.push({ ...data, id });
		this.notify();
		return id;
	}

	remove(id: string): void {
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
		this.notify();
	}

	update(id: string, data: Partial<ToastData>): void {
		const index = this.toasts.findIndex((toast) => toast.id === id);
		if (index !== -1) {
			this.toasts[index] = { ...this.toasts[index], ...data };
			this.notify();
		}
	}

	dismissAll(): void {
		for (const toast of this.toasts) {
			if (toast.onClose) {
				toast.onClose();
			}
		}
		this.toasts = [];
		this.notify();
	}

	getToasts(): ToastData[] {
		return [...this.toasts];
	}
}

export const toastState = new ToastState();

export const toast = (data: Omit<ToastData, "id"> | string): string => {
	if (typeof data === "string") {
		return toastState.add({ description: data });
	}
	return toastState.add(data);
};

toast.success = (data: Omit<ToastData, "id" | "variant"> | string): string => {
	if (typeof data === "string") {
		return toastState.add({ description: data, variant: "success" });
	}
	return toastState.add({ ...data, variant: "success" });
};

toast.warning = (data: Omit<ToastData, "id" | "variant"> | string): string => {
	if (typeof data === "string") {
		return toastState.add({ description: data, variant: "warning" });
	}
	return toastState.add({ ...data, variant: "warning" });
};

toast.error = (data: Omit<ToastData, "id" | "variant"> | string): string => {
	if (typeof data === "string") {
		return toastState.add({ description: data, variant: "destructive" });
	}
	return toastState.add({ ...data, variant: "destructive" });
};

toast.dismiss = (id: string): void => {
	toastState.remove(id);
};

toast.dismissAll = (): void => {
	toastState.dismissAll();
};