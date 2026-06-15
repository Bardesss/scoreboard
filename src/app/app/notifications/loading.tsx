import { ListSkeleton } from '@/components/shared/ListSkeleton'

export default function NotificationsLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <ListSkeleton rows={6} subtitle />
    </div>
  )
}
