import { useClientStore } from "@/stores/client.store";

export const useTheme = () => {
	const theme = useClientStore((state) => state.ui.theme);
	const setTheme = useClientStore((state) => state.setTheme);

	return {
		theme,
		setTheme,
	};
};
