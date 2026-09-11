import { PageShell } from '@/components/common/PageShell'
import { SoonState } from '@/components/common/SoonState'
import { labels } from '@/lib/labels'

export function TripSettingsPage() {
  return (
    <PageShell>
      <SoonState body={labels.soon.settings} />
    </PageShell>
  )
}
