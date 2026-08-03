import AuthForm from "@/components/auth/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daftar Gratis – SynapEd",
  description: "Buat akun SynapEd gratis dan akses seluruh kurikulum.",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
