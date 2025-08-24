import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import type { ForgotPasswordRequest } from "@/types/api";

export default function ForgotPasswordComponent() {
	const [formData, setFormData] = useState<ForgotPasswordRequest>({
		email: "",
	});
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [generalError, setGeneralError] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const navigate = useNavigate();
	const { forgotPassword, loading, error } = useAuthStore();

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.email) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = "Please enter a valid email address";
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
			await forgotPassword(formData.email);
			setIsSubmitted(true);
		} catch (error) {
			if (error instanceof CustomApiError) {
				setGeneralError(error.message);
			} else {
				setGeneralError("Failed to send reset email");
			}
		}
	};

	if (isSubmitted) {
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
							<CardTitle className="text-center text-green-600 dark:text-green-400">
								Email Sent!
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert>
								<AlertDescription>
									We've sent a password reset link to{" "}
									<strong>{formData.email}</strong>. Please check your email and
									follow the instructions to reset your password.
								</AlertDescription>
							</Alert>

							<div className="text-center space-y-4">
								<Button
									type="button"
									className="w-full"
									onClick={() => navigate({ to: "/login" })}
								>
									Back to Login
								</Button>
								<p className="text-sm text-center text-nocta-600 dark:text-nocta-400">
									Didn't receive the email? <br></br> Check your spam folder or
									try again.
								</p>
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
						<CardTitle>Reset Password</CardTitle>
						<CardDescription>
							Enter your email address and we'll send you a link to reset your
							password.
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
							</div>

							<FormActions className="mt-6">
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? (
										<>
											<Spinner className="w-4 h-4 mr-2" />
											Sending...
										</>
									) : (
										"Send Reset Link"
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

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordComponent,
});
