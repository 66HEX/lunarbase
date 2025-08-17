use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    // Only build frontend in release mode or when explicitly requested
    let profile = env::var("PROFILE").unwrap_or_default();
    let force_build = env::var("LUNARBASE_BUILD_FRONTEND").is_ok();

    if profile == "release" || force_build {
        println!("cargo:rerun-if-changed=admin-ui/src");
        println!("cargo:rerun-if-changed=admin-ui/package.json");
        println!("cargo:rerun-if-changed=admin-ui/vite.config.ts");
        println!("cargo:rerun-if-changed=admin-ui/tsconfig.json");

        let admin_ui_dir = Path::new("admin-ui");

        if !admin_ui_dir.exists() {
            panic!(
                "admin-ui directory not found. Make sure you're building from the project root."
            );
        }

        // Check if node_modules exists, if not run npm install
        let node_modules = admin_ui_dir.join("node_modules");
        if !node_modules.exists() {
            println!("Installing frontend dependencies...");
            let npm_install = Command::new("npm")
                .args(["install"])
                .current_dir(admin_ui_dir)
                .status()
                .expect("Failed to execute npm install");

            if !npm_install.success() {
                panic!("npm install failed");
            }
        }

        // Build the frontend
        println!("Building frontend for embedded deployment...");
        let npm_build = Command::new("npm")
            .args(["run", "build"])
            .current_dir(admin_ui_dir)
            .status()
            .expect("Failed to execute npm run build");

        if !npm_build.success() {
            panic!("Frontend build failed");
        }

        // Verify that dist directory was created
        let dist_dir = admin_ui_dir.join("dist");
        if !dist_dir.exists() {
            panic!("Frontend build completed but dist directory not found");
        }

        println!("Frontend build completed successfully");
    } else {
        println!(
            "Skipping frontend build in debug mode. Set LUNARBASE_BUILD_FRONTEND=1 to force build."
        );
    }
}
