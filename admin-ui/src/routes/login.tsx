import {
	createFileRoute,
	redirect,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
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
import { CustomApiError, getAuthToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";
import type { LoginRequest } from "@/types/api";

export default function LoginComponent() {
	const [formData, setFormData] = useState<LoginRequest>({
		email: "",
		password: "",
	});
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [generalError, setGeneralError] = useState("");
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" }) as { redirect?: string };
	const { login, loading, error } = useAuthStore();

	const handleInputChange = (field: keyof LoginRequest, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear field error when user starts typing
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
			navigate({ to: search.redirect || "/dashboard" });
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

	return (
		<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
			<div className="w-sm space-y-8">
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

				{/* Login Form */}
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
						</Form>
					</CardContent>
				</Card>

				{/* Footer */}
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
	beforeLoad: () => {
		// Redirect to dashboard if already authenticated
		const token = getAuthToken();
		if (token) {
			throw redirect({
				to: "/dashboard",
			});
		}
	},
});
