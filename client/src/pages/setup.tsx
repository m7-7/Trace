import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Setup() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/setup", { password });
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Could not reach the server. Check your connection.");
      } else if (err instanceof Error) {
        try {
          const body = err.message.replace(/^\d+: /, "");
          const parsed = JSON.parse(body);
          setError(typeof parsed.message === "string" ? parsed.message : "Setup failed. Please try again.");
        } catch {
          setError("Setup failed. Please try again.");
        }
      } else {
        setError("Setup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-gray-800 rounded-xl shadow-2xl">
        <h1 className="text-2xl font-semibold text-white mb-1 text-center tracking-tight">
          Welcome to Trace
        </h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          Create a password to secure your library
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password (min 10 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
            autoFocus
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
            autoComplete="new-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
