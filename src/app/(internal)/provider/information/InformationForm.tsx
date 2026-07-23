"use client";
// Provider · Information form: edit business name, location, and personalization.
import { useState, useTransition } from "react";
import type { ProviderProfileRow } from "@/lib/provider";
import type { ZoneOption } from "@/lib/operator/catalog-fields";
import { saveProfile } from "./actions";
import styles from "../provider.module.css";

type Msg = { ok: boolean; text: string } | null;

export default function InformationForm({
  providerId,
  profile,
  zones,
}: {
  providerId: string;
  profile: ProviderProfileRow;
  zones: ZoneOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(async () => {
      const result = await saveProfile(providerId, fd);
      setMsg({ ok: result.ok, text: result.message });
    });
  }

  return (
    <div className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Business name</span>
            <input name="name" className={styles.input} defaultValue={profile.name} required />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Location (zone)</span>
            <select name="zone_id" className={styles.input} defaultValue={profile.zone_id} required>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} · {z.region}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className={styles.formSubhead}>Personalization</p>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Special occasions</span>
            <textarea
              name="special_occasions"
              className={styles.textarea}
              defaultValue={profile.special_occasions}
              placeholder="e.g. anniversaries, birthdays"
            />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Dietary options</span>
            <textarea
              name="dietary_options"
              className={styles.textarea}
              defaultValue={profile.dietary_options}
              placeholder="e.g. vegetarian, gluten-free"
            />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Privacy options</span>
            <textarea
              name="privacy_options"
              className={styles.textarea}
              defaultValue={profile.privacy_options}
              placeholder="e.g. private group available"
            />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.fieldLabel}>Extras on request</span>
            <textarea
              name="extras_on_request"
              className={styles.textarea}
              defaultValue={profile.extras_on_request}
              placeholder="e.g. photographer, transport"
            />
          </label>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          {msg && (
            <span className={`${styles.formMsg} ${msg.ok ? styles.formMsgOk : styles.formMsgErr}`}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
