import { requireOnboardedUser } from "@/backend/gate";
import { PageShell } from "@/frontend/components/PageShell";
import { SettingsForm } from "@/frontend/components/SettingsForm";
import { DeleteAccountSection } from "@/frontend/components/DeleteAccountSection";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();

  return (
    <PageShell title="Settings">
      <div className="stack">
        <SettingsForm
          initialCategories={user.selectedCategories}
          initialTimezone={user.timezone}
          initialWeekStartDay={user.weekStartDay}
        />
        <hr className="divider" />
        <DeleteAccountSection />
      </div>
    </PageShell>
  );
}
