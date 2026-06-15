import { ListSkeleton } from '@/components/shared/ListSkeleton'

export default function SupportLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <ListSkeleton rows={5} action />
    </div>
  )
}
