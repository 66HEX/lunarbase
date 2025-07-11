import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
	base: "/admin/",
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
		svgr({
			include: "**/*.svg",
			svgrOptions: {
				exportType: "default",
				ref: true,
				titleProp: true,
				svgo: true,
				svgoConfig: {
					plugins: [
						{
							name: "removeViewBox",
							active: false,
						},
						{
							name: "removeDimensions",
							active: true,
						},
					],
				},
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
