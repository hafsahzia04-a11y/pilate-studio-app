import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-4">
      {/* Background decorative elements */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sage-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-sage-200 opacity-30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cream-200 opacity-50 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative w-full max-w-md">
        {/* Studio branding */}
        <div className="text-center mb-8">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sage-500 shadow-soft mb-4">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
            >
              <circle
                cx="16"
                cy="16"
                r="7"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M16 4C16 4 20 8 20 16C20 24 16 28 16 28"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M16 4C16 4 12 8 12 16C12 24 16 28 16 28"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="16"
                x2="23"
                y2="16"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            The Movement Studio
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Premium Pilates &amp; Wellness
          </p>
        </div>

        {/* Page content */}
        {children}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-stone-400">
          &copy; {new Date().getFullYear()} The Movement Studio. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}
