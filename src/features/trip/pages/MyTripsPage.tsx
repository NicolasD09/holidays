import { PageShell } from '@/components/common/PageShell'
import { SoonState } from '@/components/common/SoonState'
import { labels } from '@/lib/labels'

export function MyTripsPage() {
  return (
    <PageShell>
      <SoonState body={labels.soon.myTrips} />
    </PageShell>
  )
}
