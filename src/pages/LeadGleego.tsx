import { useEffect, useState } from "react";
import { API_URL, getAuthToken } from "@/lib/api";
import { Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LeadGleego() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openLeadGleego();
  }, []);

  const openLeadGleego = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/lead-gleego/sso`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.url) {
        window.open(data.url, "_blank");
        toast.success("Lead Gleego aberto em nova aba");
      } else {
        setError(data.error || "Erro ao autenticar no Lead Gleego");
      }
    } catch {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Autenticando no Lead Gleego...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={openLeadGleego} variant="outline">
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <ExternalLink className="h-12 w-12 text-primary" />
          <p className="text-foreground font-medium">Lead Gleego aberto em nova aba</p>
          <Button onClick={openLeadGleego} variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir novamente
          </Button>
        </div>
      )}
    </div>
  );
}
