"use client";

import { faBan } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExcludeButton({ name }: { name: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      icon={faBan}
      className="mt-3"
      onClick={() => toast({ message: `${name} excluded — it won’t get a letter`, actionLabel: "Undo" })}
    >
      Exclude
    </Button>
  );
}
