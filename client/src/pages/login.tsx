import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/login", { password });
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Could not reach the server. Check your connection.");
      } else if (err instanceof Error) {
        try {
          const body = err.message.replace(/^\d+: /, "");
          const parsed = JSON.parse(body);
          setError(typeof parsed.message === "string" ? parsed.message : "Sign in failed.");
        } catch {
          setError("Sign in failed.");
        }
      } else {
        setError("Sign in failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-gray-800 rounded-xl shadow-2xl">
        <h1 className="text-2xl font-semibold text-white mb-1 text-center tracking-tight">
          Trace
        </h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          Enter your password to continue
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
