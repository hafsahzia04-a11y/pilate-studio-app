// ─────────────────────────────────────────────────────────────────────────────
// Next.js Middleware — runs on every request before the page renders.
// Handles:
//   1. Session refresh (keep Supabase token alive)
//   2. Role-based route protection
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // Refresh the session — important for Vercel serverless
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Public routes — no auth needed ──────────────────────────────────────────
  const publicPaths = ["/login", "/signup", "/api/auth", "/_next", "/favicon"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // ── Redirect unauthenticated users to login ──────────────────────────────────
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // ── Redirect authenticated users away from login page ───────────────────────
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── Role-based route protection ───────────────────────────────────────────────
  if (user) {
    // Fetch the user's role from the profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    const routeRoles: Record<string, string[]> = {
      "/founder": ["founder"],
      "/staff": ["founder", "staff"],
      "/instructor": ["founder", "staff", "instructor"],
      "/client": ["founder", "staff", "instructor", "client"],
    };

    for (const [routePrefix, allowedRoles] of Object.entries(routeRoles)) {
      if (pathname.startsWith(routePrefix) && !allowedRoles.includes(role ?? "")) {
        // Redirect to their own dashboard
        const url = request.nextUrl.clone();
        url.pathname = `/${role ?? "client"}`;
        return NextResponse.redirect(url);
      }
    }

    // Root redirect: send each role to their dashboard
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      const dashboardMap: Record<string, string> = {
        founder: "/founder",
        staff: "/staff",
        instructor: "/instructor",
        client: "/client",
      };
      url.pathname = dashboardMap[role ?? "client"] ?? "/client";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
