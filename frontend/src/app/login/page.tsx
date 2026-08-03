import AuthForm from "@/components/auth/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk – SynapEd",
  description: "Masuk ke akun SynapEd Anda dan lanjutkan belajar.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
