"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, LogIn, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });

    if (error) {
      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials")
      ) {
        setAuthError("Incorrect email or password. Please try again.");
      } else if (error.message.includes("Email not confirmed")) {
        setAuthError(
          "Your email has not been confirmed. Please check your inbox."
        );
      } else {
        setAuthError(error.message);
      }
      return;
    }

    // Middleware will handle role-based redirect
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-stone-900">Welcome back</h2>
          <p className="mt-1 text-sm text-stone-500">
            Sign in to your studio account
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-stone-700"
            >
              Email address
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Please enter a valid email address",
                  },
                })}
                className={cn(
                  "flex h-11 w-full rounded-xl border bg-white px-3 py-2 pl-10 text-sm text-stone-800",
                  "placeholder:text-stone-400 outline-none transition-colors",
                  "focus:border-sage-400 focus:ring-2 focus:ring-sage-100",
                  errors.email
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-stone-200"
                )}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium text-stone-700"
              >
                Password
              </label>
              <button
                type="button"
                className="text-xs text-sage-600 hover:text-sage-700 hover:underline transition-colors"
                onClick={() => {
                  // Placeholder — forgot password flow
                  alert("Please contact your studio administrator to reset your password.");
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                className={cn(
                  "flex h-11 w-full rounded-xl border bg-white px-3 py-2 pl-10 pr-10 text-sm text-stone-800",
                  "placeholder:text-stone-400 outline-none transition-colors",
                  "focus:border-sage-400 focus:ring-2 focus:ring-sage-100",
                  errors.password
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-stone-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Auth error */}
          {authError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600">{authError}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="w-full mt-2"
          >
            {!isSubmitting && <LogIn className="w-4 h-4" />}
            {isSubmitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        {/* Info note */}
        <p className="mt-6 text-center text-xs text-stone-400 leading-relaxed">
          Don&apos;t have an account?{" "}
          <span className="text-stone-500">
            Contact your studio to get set up.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
