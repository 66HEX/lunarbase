import { createContext } from "react";

interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
	undefined,
);
export type { AuthContextType };
