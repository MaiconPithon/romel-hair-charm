import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler for chunk load errors (cache issues)
window.addEventListener("error", (event) => {
    const error = event.error;
    
    // Check if it's a ChunkLoadError or module loading error
    if (error && (
        error.name === "ChunkLoadError" ||
        error.message?.includes("Loading chunk") ||
        error.message?.includes("Failed to fetch dynamically imported module")
    )) {
        console.warn("Chunk load error detected - forcing reload to refresh cache", error);
        window.location.reload();
    }
});

// Also handle unhandled promise rejections that might be related to chunk loading
window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    
    if (reason && (
        reason.name === "ChunkLoadError" ||
        reason.message?.includes("Loading chunk") ||
        reason.message?.includes("Failed to fetch dynamically imported module")
    )) {
        console.warn("Chunk load rejection detected - forcing reload to refresh cache", reason);
        window.location.reload();
    }
});

createRoot(document.getElementById("root")!).render(<App />);
