import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { type CustomApiError, configurationApi } from "@/lib/api";
import type {
	CreateSystemSettingRequest,
	SystemSetting,
	UpdateSystemSettingRequest,
} from "@/types/api";

/**
 * Hook for creating a new system setting
 */
export const useCreateSetting = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (
			data: CreateSystemSettingRequest,
		): Promise<SystemSetting> => {
			return await configurationApi.createSetting(data);
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			queryClient.invalidateQueries({ queryKey: ["settings", data.category] });

			toast({
				title: "Setting Created",
				description: `Setting '${data.setting_key}' has been created successfully.`,
				variant: "default",
			});
		},
		onError: (error: CustomApiError) => {
			toast({
				title: "Error",
				description: error.message || "Failed to create setting",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for updating a system setting
 */
export const useUpdateSetting = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			category,
			settingKey,
			data,
		}: {
			category: "database" | "auth" | "api";
			settingKey: string;
			data: UpdateSystemSettingRequest;
		}): Promise<SystemSetting> => {
			return await configurationApi.updateSetting(category, settingKey, data);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			queryClient.invalidateQueries({
				queryKey: ["settings", variables.category],
			});
			queryClient.invalidateQueries({
				queryKey: ["settings", variables.category, variables.settingKey],
			});

			toast({
				title: "Setting Updated",
				description: `Setting '${variables.settingKey}' has been updated successfully.`,
				variant: "success",
			});
		},
		onError: (error: CustomApiError) => {
			toast({
				title: "Error",
				description: error.message || "Failed to update setting",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for deleting a system setting
 */
export const useDeleteSetting = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			category,
			settingKey,
		}: {
			category: "database" | "auth" | "api";
			settingKey: string;
		}): Promise<void> => {
			return await configurationApi.deleteSetting(category, settingKey);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			queryClient.invalidateQueries({
				queryKey: ["settings", variables.category],
			});
			queryClient.removeQueries({
				queryKey: ["settings", variables.category, variables.settingKey],
			});

			toast({
				title: "Setting Deleted",
				description: `Setting '${variables.settingKey}' has been deleted successfully.`,
				variant: "default",
			});
		},
		onError: (error: CustomApiError) => {
			toast({
				title: "Error",
				description: error.message || "Failed to delete setting",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for resetting a system setting to default value
 */
export const useResetSetting = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			category,
			settingKey,
		}: {
			category: "database" | "auth" | "api";
			settingKey: string;
		}): Promise<SystemSetting> => {
			return await configurationApi.resetSetting(category, settingKey);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			queryClient.invalidateQueries({
				queryKey: ["settings", variables.category],
			});
			queryClient.invalidateQueries({
				queryKey: ["settings", variables.category, variables.settingKey],
			});

			toast({
				title: "Setting Reset",
				description: `Setting '${variables.settingKey}' has been reset to default value.`,
				variant: "default",
			});
		},
		onError: (error: CustomApiError) => {
			toast({
				title: "Error",
				description: error.message || "Failed to reset setting",
				variant: "destructive",
			});
		},
	});
};
