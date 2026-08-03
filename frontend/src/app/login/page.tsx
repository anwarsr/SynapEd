import AuthForm from "@/components/auth/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk – SynapEd",
  description: "Masuk ke akun SynapEd Anda dan lanjutkan belajar.",
};

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;

  // Hanya jalur internal yang diterima — mencegah open redirect
  // ke domain luar lewat ?next=https://...
  const redirectTo = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <AuthForm mode="login" redirectTo={redirectTo} />;
}
