import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const stateManageRewrite = () => ({
  name: "state-manage-rewrite",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/state-manage") {
        req.url = "/state-manage/index.html";
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), stateManageRewrite()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        stateManage: resolve(__dirname, "state-manage/index.html"),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
  },
});
