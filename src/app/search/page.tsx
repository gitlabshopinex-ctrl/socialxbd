import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import SearchClient from "@/components/SearchClient";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 size={26} className="animate-spin text-accent" />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}