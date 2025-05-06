import { EventCalendar } from "@/components/event-calendar"

export const metadata = {
  title: "Event Calendar - Dashboard",
  description: "View all your upcoming live sessions and events",
}

export default function CalendarPage() {
  return (
    <div className="container py-6">
      <EventCalendar variant="student" />
    </div>
  )
}