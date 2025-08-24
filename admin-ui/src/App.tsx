import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toast";
import { ThemeProvider } from "./components/layout/ThemeProvider";

import { routeTree } from "./routeTree.gen";

const router = createRouter({
	routeTree,
	basepath: "/admin/",
});

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		},
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider defaultTheme="dark">
				<RouterProvider router={router} />
				<Toaster />
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
