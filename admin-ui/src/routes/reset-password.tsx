import {
	createFileRoute,
	Link,
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
import { CustomApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";

interface ResetPasswordFormData {
	password: string;
	confirmPassword: string;
}

export default function ResetPasswordComponent() {
	const search = useSearch({ from: "/reset-password" }) as { token?: string };
	const [formData, setFormData] = useState<ResetPasswordFormData>({
		password: "",
		confirmPassword: "",
	});
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [generalError, setGeneralError] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const navigate = useNavigate();
	const { resetPassword, loading, error } = useAuthStore();

	const token = search.token;

	if (!token) {
		return (
			<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
				<div className="w-sm space-y-8">
					<div className="text-center">
						<div className="flex justify-center mb-4">
							<div className="w-16 h-16 bg-nocta-700 rounded-2xl flex items-center justify-center">
								<LunarLogo className="h-10 w-10 text-white" />
							</div>
						</div>
						<h1 className="text-3xl font-medium text-nocta-900 dark:text-nocta-100">
							LunarBase
						</h1>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-center text-red-600 dark:text-red-400">
								Invalid Reset Link
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert variant="destructive">
								<AlertDescription>
									This password reset link is invalid or has expired. Please
									request a new one.
								</AlertDescription>
							</Alert>

							<div className="text-center space-y-4">
								<Button
									onClick={() => navigate({ to: "/forgot-password" })}
									className="w-full"
								>
									Request New Reset Link
								</Button>
								<Link
									to="/login"
									className="text-sm text-nocta-600 hover:text-nocta-500 dark:text-nocta-400 dark:hover:text-nocta-300"
								>
									Back to Login
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.password) {
			newErrors.password = "Password is required";
		} else if (formData.password.length < 8) {
			newErrors.password = "Password must be at least 8 characters long";
		}

		if (!formData.confirmPassword) {
			newErrors.confirmPassword = "Please confirm your password";
		} else if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) {
			setErrors((prev) => ({ ...prev, [field]: "" }));
		}
		if (generalError) {
			setGeneralError("");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateForm()) return;

		try {
			await resetPassword(token, formData.password);
			setIsSubmitted(true);
		} catch (error) {
			if (error instanceof CustomApiError) {
				setGeneralError(error.message);
			} else {
				setGeneralError("Failed to reset password");
			}
		}
	};

	if (isSubmitted) {
		return (
			<div className="min-h-screen bg-custom-radial flex items-center justify-center px-4">
				<div className="w-sm space-y-8">
					<div className="text-center">
						<div className="flex justify-center mb-4">
							<div className="w-16 h-16 bg-nocta-700 rounded-2xl flex items-center justify-center">
								<LunarLogo className="h-10 w-10 text-white" />
							</div>
						</div>
						<h1 className="text-3xl font-medium text-nocta-900 dark:text-nocta-100">
							LunarBase
						</h1>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-center text-green-600 dark:text-green-400">
								Password Reset Successful!
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert>
								<AlertDescription>
									Your password has been successfully reset. You can now log in
									with your new password.
								</AlertDescription>
							</Alert>

							<div className="text-center">
								<Button
									type="button"
									className="w-full"
									onClick={() => navigate({ to: "/login" })}
								>
									Go to Login
								</Button>
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
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<div className="w-16 h-16 bg-nocta-700 rounded-2xl flex items-center justify-center">
							<LunarLogo className="h-10 w-10 text-white" />
						</div>
					</div>
					<h1 className="text-3xl font-medium text-nocta-900 dark:text-nocta-100">
						LunarBase
					</h1>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Reset Your Password</CardTitle>
						<CardDescription>Enter your new password below.</CardDescription>
					</CardHeader>
					<CardContent>
						<Form onSubmit={handleSubmit}>
							<div className="space-y-4">
								{(generalError || error) && (
									<Alert variant="destructive" className="w-full">
										<AlertDescription>{generalError || error}</AlertDescription>
									</Alert>
								)}

								<FormField name="password" error={errors.password}>
									<FormLabel required>New Password</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Enter your new password"
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

								<FormField
									name="confirmPassword"
									error={errors.confirmPassword}
								>
									<FormLabel required>Confirm New Password</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Confirm your new password"
											className="w-full"
											value={formData.confirmPassword}
											onChange={(e) =>
												handleInputChange("confirmPassword", e.target.value)
											}
											disabled={loading}
											variant={errors.confirmPassword ? "error" : "default"}
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
											Resetting...
										</>
									) : (
										"Reset Password"
									)}
								</Button>
							</FormActions>

							<div className="mt-6 text-center">
								<p className="text-sm text-nocta-600 dark:text-nocta-400">
									Remembered your password?{" "}
									<Link
										to="/login"
										className="font-medium text-nocta-600 hover:text-nocta-500 dark:text-nocta-400 dark:hover:text-nocta-300 transition-colors duration-300"
									>
										Back to Login
									</Link>
								</p>
							</div>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/reset-password")({
	component: ResetPasswordComponent,
});
