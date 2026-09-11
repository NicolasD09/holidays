import { PageShell } from '@/components/common/PageShell'
import { SoonState } from '@/components/common/SoonState'
import { labels } from '@/lib/labels'

export function CategoryPage() {
  return (
    <PageShell>
      <SoonState body={labels.soon.category} />
    </PageShell>
  )
}
