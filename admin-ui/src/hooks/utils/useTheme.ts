import { useClientStore } from "@/stores/client.store";

/**
 * Hook for theme management
 * @returns Object containing current theme and setter function
 */
export const useTheme = () => {
	const theme = useClientStore((state) => state.ui.theme);
	const setTheme = useClientStore((state) => state.setTheme);

	return {
		theme,
		setTheme,
	};
};
