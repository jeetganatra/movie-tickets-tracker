import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TrackerDashboard } from "@/components/tracker-dashboard";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/signin");
  }

  return (
    <TrackerDashboard
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}
