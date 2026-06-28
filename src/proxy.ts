import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  if (!request.auth) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
});

export const config = {
  matcher: [
    "/((?!api|signin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
