import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import LunarLogo from "@/assets/lunar.svg";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth-persist.store";

export default function AuthSuccessComponent() {
	const navigate = useNavigate();
	const { fetchUser, setLoading } = useAuthStore();

	useEffect(() => {
		const handleOAuthSuccess = async () => {
			try {
				setLoading(true);
				// Fetch user data after successful OAuth
				await fetchUser();
				// Redirect to dashboard after 10 seconds
				const timer = setTimeout(() => {
					navigate({ to: "/dashboard" });
				}, 2000);
				// Return cleanup function
				return timer;
			} catch (error) {
				console.error("Failed to fetch user after OAuth:", error);
				// Redirect to login on error
				navigate({ to: "/login" });
				setLoading(false);
			}
		};

		let timer: NodeJS.Timeout | undefined;
		handleOAuthSuccess().then((timerRef) => {
			timer = timerRef;
			setLoading(false);
		});

		// Cleanup function
		return () => {
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, [fetchUser, navigate, setLoading]);

	return (
		<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
			<div className="w-sm space-y-8 text-center">
				{/* Header */}
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<div className="w-16 h-16 bg-gradient-to-br from-nocta-600 to-nocta-800 rounded-2xl flex items-center justify-center">
							<LunarLogo className="h-10 w-10 text-white" />
						</div>
					</div>
					<h1 className="text-3xl font-bold text-nocta-900 dark:text-nocta-100">
						LunarBase
					</h1>
					<p className="mt-2 text-nocta-600 dark:text-nocta-400">Admin Panel</p>
				</div>

				{/* Loading State */}
				<div className="space-y-4">
					<Spinner className="w-8 h-8 mx-auto" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Completing authentication...
					</p>
				</div>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/auth/success")({
	component: AuthSuccessComponent,
});
