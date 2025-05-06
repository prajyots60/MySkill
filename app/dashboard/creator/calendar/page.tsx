import { EventCalendar } from "@/components/event-calendar"

export const metadata = {
  title: "Event Calendar - Creator Dashboard",
  description: "Manage your upcoming live sessions and events",
}

export default function CreatorCalendarPage() {
  return (
    <div className="container py-6">
      <EventCalendar variant="creator" />
    </div>
  )
}