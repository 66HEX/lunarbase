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

				await fetchUser();

				const { user } = useAuthStore.getState();
				const redirectTo =
					user?.role === "admin" ? "/dashboard" : "/collections";
				const timer = setTimeout(() => {
					navigate({ to: redirectTo });
				}, 2000);

				return timer;
			} catch (error) {
				console.error("Failed to fetch user after OAuth:", error);

				navigate({ to: "/login" });
				setLoading(false);
			}
		};

		let timer: NodeJS.Timeout | undefined;
		handleOAuthSuccess().then((timerRef) => {
			timer = timerRef;
			setLoading(false);
		});

		return () => {
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, [fetchUser, navigate, setLoading]);

	return (
		<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
			<div className="w-sm space-y-8 text-center">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<div className="w-16 h-16 bg-nocta-800 rounded-2xl flex items-center justify-center border border-nocta-50/5">
							<LunarLogo className="h-10 w-10 text-white" />
						</div>
					</div>
					<h1 className="text-3xl font-light text-nocta-900 dark:text-nocta-100">
						LunarBase
					</h1>
				</div>

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
