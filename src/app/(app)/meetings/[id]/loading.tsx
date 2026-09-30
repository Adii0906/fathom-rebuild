import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading meeting">
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-[420px] rounded-xl" /></div>
        <Skeleton className="h-[560px] rounded-xl lg:col-span-5" />
      </div>
    </div>
  );
}
