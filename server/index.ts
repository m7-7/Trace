import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { buildSessionMiddleware } from "./auth";
import path from "path";
import { execSync } from "child_process";
import sharp from "sharp";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(buildSessionMiddleware());

function log(message: string) {
  console.log(message);
}

function serveStatic(app: express.Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;

      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

function logSharpDiagnostics() {
  try {
    const versions = sharp.versions as Record<string, string>;
    const heifFormat = (sharp.format as any).heif;
    const heifInput = heifFormat?.input ?? null;

    // Find the path of sharp's compiled native addon
    let nodePath = "(unknown)";
    try {
      // sharp's .node file lives inside @img/sharp-linux-x64 or similar
      nodePath = require.resolve("sharp").replace(/index\.js$/, "");
    } catch {}

    // ldd on the .node file reveals whether it links to system or bundled libvips
    let lddOutput = "(ldd unavailable)";
    try {
      const nodeFiles = execSync(`find "${nodePath}" -name "*.node" 2>/dev/null | head -1`, { timeout: 3000 })
        .toString().trim();
      if (nodeFiles) {
        lddOutput = execSync(`ldd "${nodeFiles}" 2>/dev/null | grep -E "vips|heif|de265"`, { timeout: 3000 })
          .toString().trim() || "(no vips/heif/de265 in ldd output)";
      }
    } catch {}

    log("=== sharp diagnostics ===");
    log(`  sharp : ${versions.sharp}`);
    log(`  vips  : ${versions.vips}`);
    log(`  heif  : ${versions.heif ?? "NOT PRESENT — HEIC decode unavailable"}`);
    log(`  heif input capable: ${heifInput ? "yes" : "no"}`);
    log(`  ldd grep: ${lddOutput.replace(/\n/g, " | ")}`);
    log("=========================");
  } catch (err: any) {
    log(`sharp diagnostics failed: ${err.message}`);
  }
}

(async () => {
  logSharpDiagnostics();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
