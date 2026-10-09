import { auth } from "@/auth";

export default auth((request) => {
  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;

    if (callbackUrl && callbackUrl !== "/login") {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }

    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*", "/invitations/:path*"],
};
