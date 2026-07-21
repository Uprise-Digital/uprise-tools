"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function ForgetPasswordPage() {
  useEffect(() => {
    redirect("/login");
  }, []);

  return null;
}
