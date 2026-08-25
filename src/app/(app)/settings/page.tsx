import { requireOnboardedUser } from "@/backend/gate";
import { PageShell } from "@/frontend/components/PageShell";
import { PersonalizationForm } from "@/frontend/components/PersonalizationForm";
import { SettingsForm } from "@/frontend/components/SettingsForm";
import { DataExportSection } from "@/frontend/components/DataExportSection";
import { DeleteAccountSection } from "@/frontend/components/DeleteAccountSection";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();

  return (
    <PageShell title="Settings">
      <div className="stack">
        <PersonalizationForm initialName={user.name ?? ""} />
        <hr className="divider" />
        <SettingsForm
          initialCategories={user.selectedCategories}
          initialTimezone={user.timezone}
          initialWeekStartDay={user.weekStartDay}
        />
        <hr className="divider" />
        <DataExportSection />
        <hr className="divider" />
        <DeleteAccountSection />
      </div>
    </PageShell>
  );
}
