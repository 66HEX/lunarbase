import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import LunarLogo from "@/assets/lunar.svg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormActions,
	FormControl,
	FormField,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { CustomApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";
import type { LoginRequest } from "@/types/api";

const OAuthButton = ({
	provider,
	icon,
	onClick,
	disabled,
}: {
	provider: string;
	icon: React.ReactNode;
	onClick: () => void;
	disabled: boolean;
}) => (
	<Button
		type="button"
		variant="secondary"
		className="w-full"
		onClick={onClick}
		disabled={disabled}
	>
		{icon}
		Continue with {provider}
	</Button>
);

export default function LoginComponent() {
	const [formData, setFormData] = useState<LoginRequest>({
		email: "",
		password: "",
	});
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [generalError, setGeneralError] = useState("");
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" }) as { redirect?: string };
	const { login, loginWithOAuth, getOAuthProviders, loading, error } =
		useAuthStore();
	const oauthProviders = getOAuthProviders();

	const handleInputChange = (field: keyof LoginRequest, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));

		if (errors[field]) {
			setErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.email) {
			newErrors.email = "Email is required";
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = "Please enter a valid email";
		}

		if (!formData.password) {
			newErrors.password = "Password is required";
		} else if (formData.password.length < 8) {
			newErrors.password = "Password must be at least 8 characters";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) return;

		setGeneralError("");

		try {
			await login(formData.email, formData.password);
			const { user } = useAuthStore.getState();
			const redirectTo =
				search.redirect ||
				(user?.role === "admin" ? "/dashboard" : "/collections");
			navigate({ to: redirectTo });
		} catch (error) {
			if (error instanceof CustomApiError) {
				if (error.statusCode === 401) {
					setGeneralError("Invalid email or password");
				} else if (error.validationErrors) {
					const fieldErrors: { [key: string]: string } = {};
					error.validationErrors.forEach((msg) => {
						if (msg.includes("email")) fieldErrors.email = msg;
						else if (msg.includes("password")) fieldErrors.password = msg;
					});
					setErrors(fieldErrors);
				} else {
					setGeneralError(error.message);
				}
			} else {
				setGeneralError("An unexpected error occurred");
			}
		}
	};

	const handleOAuthLogin = async (provider: string) => {
		try {
			await loginWithOAuth(provider);
		} catch (error) {
			if (error instanceof CustomApiError) {
				setGeneralError(error.message);
			} else {
				setGeneralError("OAuth login failed");
			}
		}
	};

	return (
		<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
			<div className="w-sm space-y-8">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<div className="w-16 h-16 bg-gradient-to-br from-nocta-600 to-nocta-800 rounded-2xl flex items-center justify-center">
							<LunarLogo className="h-10 w-10 text-white" />
						</div>
					</div>
					<h1 className="text-3xl font-medium text-nocta-900 dark:text-nocta-100">
						LunarBase
					</h1>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">Login</CardTitle>
						<CardDescription>
							Sign in to access the LunarBase admin panel
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form onSubmit={handleSubmit}>
							<div className="space-y-4">
								{(generalError || error) && (
									<Alert variant="destructive" className="w-full">
										<AlertDescription>{generalError || error}</AlertDescription>
									</Alert>
								)}

								<FormField name="email" error={errors.email}>
									<FormLabel required>Email</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="admin@example.com"
											className="w-full"
											value={formData.email}
											onChange={(e) =>
												handleInputChange("email", e.target.value)
											}
											disabled={loading}
											variant={errors.email ? "error" : "default"}
										/>
									</FormControl>
									<FormMessage />
								</FormField>

								<FormField name="password" error={errors.password}>
									<FormLabel required>Password</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Enter your password"
											className="w-full"
											value={formData.password}
											onChange={(e) =>
												handleInputChange("password", e.target.value)
											}
											disabled={loading}
											variant={errors.password ? "error" : "default"}
										/>
									</FormControl>
									<FormMessage />
								</FormField>

								<div className="text-right">
									<Link
										to="/forgot-password"
										className="text-sm text-nocta-600 hover:text-nocta-500 dark:text-nocta-400 dark:hover:text-nocta-300 transition-colors duration-300"
									>
										Forgot your password?
									</Link>
								</div>
							</div>

							<FormActions className="mt-6">
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? (
										<>
											<Spinner className="w-4 h-4 mr-2" />
											Signing in...
										</>
									) : (
										"Sign In"
									)}
								</Button>
							</FormActions>

							<div className="relative my-6">
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-nocta-300 dark:text-nocta-700">
										Or continue with
									</span>
								</div>
							</div>

							<div className="space-y-3">
								{oauthProviders.map((provider) => {
									const getProviderIcon = () => {
										switch (provider.name) {
											case "google":
												return <FaGoogle className="w-4 h-4 mr-2" />;
											case "github":
												return <GitHubLogoIcon className="w-4 h-4 mr-2" />;
											default:
												return null;
										}
									};

									return (
										<OAuthButton
											key={provider.name}
											provider={provider.display_name}
											icon={getProviderIcon()}
											onClick={() => handleOAuthLogin(provider.name)}
											disabled={loading}
										/>
									);
								})}
							</div>

							<div className="mt-6 text-center">
								<p className="text-sm text-nocta-600 dark:text-nocta-400">
									Don't have an account?{" "}
									<Link
										to="/register"
										className="font-medium text-nocta-600 hover:text-nocta-500 dark:text-nocta-400 dark:hover:text-nocta-300"
									>
										Sign up
									</Link>
								</p>
							</div>
						</Form>
					</CardContent>
				</Card>

				<div className="text-center text-sm text-nocta-600 dark:text-nocta-400">
					<p>© 2025 LunarBase. All rights reserved.</p>
					<p className="mt-1">Need help? Contact your system administrator.</p>
				</div>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/login")({
	component: LoginComponent,
	beforeLoad: async () => {
		const { user } = useAuthStore.getState();
		if (user) {
			throw redirect({
				to: user.role === "admin" ? "/dashboard" : "/collections",
			});
		}
	},
});
