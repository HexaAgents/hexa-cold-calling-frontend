"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import PageLoader from "@/components/ui/page-loader";
import type { User } from "@/types";

interface AuthGuardProps {
  children: (user: User) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const stored = localStorage.getItem("user");

    if (!token || !stored) {
      router.push("/login");
      return;
    }

    let parsedUser: User;
    try {
      parsedUser = JSON.parse(stored);
    } catch {
      router.push("/login");
      return;
    }

    const timeout = setTimeout(() => {
      setUser(parsedUser);
      setLoading(false);
    }, 0);
    return () => clearTimeout(timeout);
  }, [router, pathname]);

  if (loading || !user) {
    return <PageLoader fullScreen />;
  }

  return <>{children(user)}</>;
}
