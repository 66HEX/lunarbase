import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import LunarLogo from "@/assets/lunar.svg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthErrorComponent() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/auth/error" }) as { message?: string };
	const errorMessage = search.message || "Authentication failed";

	useEffect(() => {
		const timer = setTimeout(() => {
			navigate({ to: "/login" });
		}, 10000);

		return () => clearTimeout(timer);
	}, [navigate]);

	return (
		<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
			<div className="w-sm space-y-8">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<div className="w-16 h-16 bg-nocta-700 rounded-2xl flex items-center justify-center">
							<LunarLogo className="h-10 w-10 text-white" />
						</div>
					</div>
					<h1 className="text-3xl font-light text-nocta-900 dark:text-nocta-100">
						LunarBase
					</h1>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-center text-red-600 dark:text-red-400">
							Authentication Error
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert variant="destructive">
							<AlertDescription>
								{decodeURIComponent(errorMessage)}
							</AlertDescription>
						</Alert>

						<div className="text-center space-y-4">
							<p className="text-sm text-nocta-600 dark:text-nocta-400">
								You will be redirected to the login page in 10 seconds.
							</p>
							<Button
								onClick={() => navigate({ to: "/login" })}
								className="w-full"
							>
								Return to Login
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/auth/error")({
	component: AuthErrorComponent,
});
