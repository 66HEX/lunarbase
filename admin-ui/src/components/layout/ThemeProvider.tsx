import { useEffect } from "react";
import { useClientStore } from "@/stores/client.store";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
};

export function ThemeProvider({
	children,
	defaultTheme = "system",
}: ThemeProviderProps) {
	const theme = useClientStore((state) => state.ui.theme);
	const setTheme = useClientStore((state) => state.setTheme);

	useEffect(() => {
		if (!theme) {
			setTheme(defaultTheme);
		}
	}, [theme, defaultTheme, setTheme]);

	useEffect(() => {
		const root = window.document.documentElement;

		root.classList.remove("light", "dark");

		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";

			root.classList.add(systemTheme);
			return;
		}

		root.classList.add(theme);
	}, [theme]);

	return <>{children}</>;
}
