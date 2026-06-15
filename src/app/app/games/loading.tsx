import { ListSkeleton } from '@/components/shared/ListSkeleton'

export default function GamesLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <ListSkeleton rows={6} action />
    </div>
  )
}
