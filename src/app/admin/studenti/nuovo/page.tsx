"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { StudentEditor } from "@/modules/crm/student-editor";
export default function Page() {
  const router = useRouter(),
    saved = useRef(false);
  return (
    <StudentEditor
      close={() => {
        if (!saved.current) router.replace("/admin/studenti");
      }}
      saved={(id) => {
        saved.current = true;
        router.replace(`/admin/studenti/${encodeURIComponent(id)}`);
      }}
    />
  );
}
