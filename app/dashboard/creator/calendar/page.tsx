import { EventCalendar } from "@/components/event-calendar"

export const metadata = {
  title: "Event Calendar - Creator Dashboard",
  description: "Manage your upcoming live sessions and events",
}

export default function CreatorCalendarPage() {
  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <EventCalendar variant="creator" />
    </div>
  )
}