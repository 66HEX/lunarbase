import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
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
import { authApi, CustomApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";
import type { RegisterRequest } from "@/types/api";

export default function RegisterComponent() {
	const [formData, setFormData] = useState<RegisterRequest>({
		email: "",
		password: "",
		username: "",
	});
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [generalError, setGeneralError] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const navigate = useNavigate();

	const handleInputChange = (field: keyof RegisterRequest, value: string) => {
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

		if (!formData.username) {
			newErrors.username = "Username is required";
		} else if (formData.username.length < 3) {
			newErrors.username = "Username must be at least 3 characters";
		} else if (formData.username.length > 30) {
			newErrors.username = "Username must be less than 30 characters";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) return;

		setGeneralError("");
		setLoading(true);

		try {
			await authApi.register(formData);
			setSuccess(true);
		} catch (error) {
			if (error instanceof CustomApiError) {
				if (error.validationErrors) {
					const fieldErrors: { [key: string]: string } = {};
					error.validationErrors.forEach((msg) => {
						if (msg.includes("email") || msg.includes("Email")) {
							fieldErrors.email = msg;
						} else if (msg.includes("password") || msg.includes("Password")) {
							fieldErrors.password = msg;
						} else if (msg.includes("username") || msg.includes("Username")) {
							fieldErrors.username = msg;
						}
					});
					setErrors(fieldErrors);
				} else {
					setGeneralError(error.message);
				}
			} else {
				setGeneralError("An unexpected error occurred");
			}
		} finally {
			setLoading(false);
		}
	};

	if (success) {
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
						<p className="mt-2 text-nocta-600 dark:text-nocta-400">
							Admin Panel
						</p>
					</div>

					{/* Success Message */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-green-600">
								Registration Successful
							</CardTitle>
							<CardDescription>
								Your account has been created successfully!
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
									<AlertDescription className="text-green-800 dark:text-green-200">
										We've sent a verification email to{" "}
										<strong>{formData.email}</strong>. Please check your inbox
										and click the verification link to activate your account.
									</AlertDescription>
								</Alert>

								<div className="space-y-3">
									<Button
										type="button"
										className="w-full"
										onClick={() => navigate({ to: "/login" })}
									>
										Go to Login
									</Button>
									<p className="text-sm text-center text-nocta-600 dark:text-nocta-400">
										Didn't receive the email? Check your spam folder or contact
										support.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

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

				{/* Registration Form */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							Create Account
						</CardTitle>
						<CardDescription>
							Sign up to access the LunarBase admin panel
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form onSubmit={handleSubmit}>
							<div className="space-y-4">
								{generalError && (
									<Alert variant="destructive" className="w-full">
										<AlertDescription>{generalError}</AlertDescription>
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

								<FormField name="username" error={errors.username}>
									<FormLabel required>Username</FormLabel>
									<FormControl>
										<Input
											type="text"
											placeholder="john_doe"
											className="w-full"
											value={formData.username}
											onChange={(e) =>
												handleInputChange("username", e.target.value)
											}
											disabled={loading}
											variant={errors.username ? "error" : "default"}
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
											Creating account...
										</>
									) : (
										"Create Account"
									)}
								</Button>
							</FormActions>

							{/* Login Link */}
							<div className="mt-6 text-center">
								<p className="text-sm text-nocta-600 dark:text-nocta-400">
									Already have an account?{" "}
									<Link
										to="/login"
										className="font-medium text-nocta-600 hover:text-nocta-500 dark:text-nocta-400 dark:hover:text-nocta-300"
									>
										Sign in
									</Link>
								</p>
							</div>
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

export const Route = createFileRoute("/register")({
	component: RegisterComponent,
	beforeLoad: async () => {
		// Check if already authenticated by checking if user exists in store
		// Don't call checkAuth() here as it would cause 401 error on register page
		const { user } = useAuthStore.getState();
		if (user) {
			throw redirect({
				to: "/dashboard",
			});
		}
	},
});
