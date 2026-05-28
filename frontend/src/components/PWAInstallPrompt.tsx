import { useState, useEffect } from "react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export function PWAInstallPrompt() {
  const { isInstallable, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleInstall = async () => {
    const installed = await installApp();
    if (installed) {
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white/80 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3">
        <Download className="w-6 h-6 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Install Oryn Finance</h3>
          <p className="text-sm text-white/90 mb-3">
            Install our app for faster access and offline support
          </p>
          <Button
            onClick={handleInstall}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Install App
          </Button>
        </div>
      </div>
    </div>
  );
}
