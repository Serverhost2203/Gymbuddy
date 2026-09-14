import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.profile?.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
