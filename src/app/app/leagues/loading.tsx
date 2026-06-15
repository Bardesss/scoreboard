import { ListSkeleton } from '@/components/shared/ListSkeleton'

export default function LeaguesLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <ListSkeleton rows={5} action rowHeight={64} gap={12} />
    </div>
  )
}
