import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
	base: "/admin/",
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: false,
				secure: false,
				cookieDomainRewrite: false,
				preserveHeaderKeyCase: true,
				xfwd: true,
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq, req) => {
						// Forward cookies from the original request
						if (req.headers.cookie) {
							proxyReq.setHeader("cookie", req.headers.cookie);
						}
					});

					proxy.on("proxyRes", (proxyRes, _req, res) => {
						// Forward Set-Cookie headers from the backend response
						if (proxyRes.headers["set-cookie"]) {
							res.setHeader("set-cookie", proxyRes.headers["set-cookie"]);
						}
					});
				},
			},
		},
	},
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
