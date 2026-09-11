import { PageShell } from '@/components/common/PageShell'
import { SoonState } from '@/components/common/SoonState'
import { labels } from '@/lib/labels'

export function CreateTripPage() {
  return (
    <PageShell>
      <SoonState body={labels.soon.createTrip} />
    </PageShell>
  )
}
