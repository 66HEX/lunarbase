import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
	base: "/admin/",
	css: {
		transformer: "lightningcss",
	},
	build: {
		minify: "terser",
		cssMinify: "lightningcss",
		sourcemap: false,
		target: "es2020",
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			output: {
				entryFileNames: "assets/[name]-[hash].js",
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash].[ext]",
				manualChunks: {
					vendor: ["react", "react-dom"],
					router: ["@tanstack/react-router", "@tanstack/react-query"],
					ui: ["@radix-ui/react-icons", "@phosphor-icons/react", "react-icons"],
					styling: ["clsx", "tailwind-merge", "class-variance-authority"],
					state: ["zustand", "immer"],
					validation: ["zod"],
					editor: ["@uiw/react-textarea-code-editor"],
					tiptap: [
						"@tiptap/react",
						"@tiptap/core",
						"@tiptap/starter-kit",
						"@tiptap/extension-text-style",
					],
				},
			},
		},
		assetsInlineLimit: 4096,
		chunkSizeWarningLimit: 1000,
		terserOptions: {
			compress: {
				ecma: 2020,
				module: true,
				toplevel: true,
				passes: 2,
				pure_getters: true,
				drop_console: true,
				drop_debugger: true,
			},
			mangle: {
				toplevel: true,
			},
			format: {
				comments: false,
			},
		},
	},
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
						if (req.headers.cookie) {
							proxyReq.setHeader("cookie", req.headers.cookie);
						}
					});

					proxy.on("proxyRes", (proxyRes, _req, res) => {
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
