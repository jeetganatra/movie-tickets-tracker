import { auth } from "@/auth";

export async function getAuthenticatedUser() {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name: session.user.name,
    image: session.user.image,
  };
}
