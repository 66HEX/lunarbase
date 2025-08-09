import { useQuery } from "@tanstack/react-query";
import { configurationApi } from "@/lib/api";
import type { SystemSetting } from "@/types/api";

/**
 * Hook for fetching all system settings
 */
export const useAllSettings = () => {
	return useQuery({
		queryKey: ["settings"],
		queryFn: async (): Promise<SystemSetting[]> => {
			return await configurationApi.getAllSettings();
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching settings by category
 */
export const useSettingsByCategory = (category: "database" | "auth" | "api") => {
	return useQuery({
		queryKey: ["settings", category],
		queryFn: async (): Promise<SystemSetting[]> => {
			return await configurationApi.getSettingsByCategory(category);
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching a specific setting
 */
export const useSetting = (
	category: "database" | "auth" | "api",
	settingKey: string,
	enabled: boolean = true,
) => {
	return useQuery({
		queryKey: ["settings", category, settingKey],
		queryFn: async (): Promise<SystemSetting> => {
			return await configurationApi.getSetting(category, settingKey);
		},
		enabled,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};