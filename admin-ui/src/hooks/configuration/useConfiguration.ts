import { useQuery } from "@tanstack/react-query";
import { authApi, configurationApi } from "@/lib/api";
import type { OAuthStatusResponse, SystemSetting } from "@/types/api";

/**
 * Hook for fetching all system settings
 */
export const useAllSettings = () => {
	return useQuery({
		queryKey: ["settings"],
		queryFn: async (): Promise<SystemSetting[]> => {
			return await configurationApi.getAllSettings();
		},
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching OAuth status (public endpoint)
 */
export const useOAuthStatus = () => {
	return useQuery({
		queryKey: ["oauth-status"],
		queryFn: async (): Promise<OAuthStatusResponse> => {
			const response = await authApi.getOAuthStatus();
			return response.data;
		},
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching settings by category
 */
export const useSettingsByCategory = (
	category:
		| "database"
		| "auth"
		| "api"
		| "email"
		| "oauth"
		| "storage"
		| "security_headers",
) => {
	return useQuery({
		queryKey: ["settings", category],
		queryFn: async (): Promise<SystemSetting[]> => {
			return await configurationApi.getSettingsByCategory(category);
		},
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching a specific setting
 */
export const useSetting = (
	category:
		| "database"
		| "auth"
		| "api"
		| "email"
		| "oauth"
		| "storage"
		| "security_headers",
	settingKey: string,
	enabled: boolean = true,
) => {
	return useQuery({
		queryKey: ["settings", category, settingKey],
		queryFn: async (): Promise<SystemSetting> => {
			return await configurationApi.getSetting(category, settingKey);
		},
		enabled,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};
