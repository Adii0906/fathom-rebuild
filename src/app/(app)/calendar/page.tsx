import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar-view";
import { getCalendarEvents } from "@/lib/store";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const events = await getCalendarEvents();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Past meetings link to their recording; upcoming ones are ready to import once they finish.</p>
      </div>
      <CalendarView events={events} nowIso={new Date().toISOString()} />
    </div>
  );
}
