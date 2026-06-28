import { Film, LogIn } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "This Google account could not sign in. Use a verified Google account, or ask the app owner to check the allowlist.",
  Configuration: "Google login is not configured yet.",
  OAuthCallbackError: "Google could not complete the sign-in request.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm border-y border-border/60 py-10 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/10">
          <Film className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="font-display text-5xl tracking-wide">
          <span className="text-amber-500">MOVIE</span>
          <span className="text-foreground">TRACKER</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to manage your private ticket trackers.
        </p>

        {error && (
          <p className="mt-5 border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {ERROR_MESSAGES[error] || "Google sign-in failed. Please try again."}
          </p>
        )}

        <form
          className="mt-7"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button
            type="submit"
            className="w-full gap-2 bg-amber-500 font-semibold text-black hover:bg-amber-400"
          >
            <LogIn className="h-4 w-4" />
            Sign in with Google
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground/60">
          Each Google account gets private trackers and email alerts.
        </p>
      </section>
    </main>
  );
}
