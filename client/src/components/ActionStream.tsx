import { useNavigate } from "react-router-dom";
import type { ActionItem } from "../types";
import { Pill } from "../ui";
import { formatDate } from "../utils";

const URGENCY_TONE = { urgent: "danger", high: "warning", normal: "brand" } as const;
const URGENCY_LABEL = { urgent: "Urgent", high: "Soon", normal: "Scheduled" };

export function ActionCard({ action }: { action: ActionItem }) {
  const nav = useNavigate();
  return (
    <div className={`action-card u-${action.urgency}`} onClick={() => nav(action.sourcePath)}>
      <div className="accent-bar" />
      <div className="action-body">
        <div className="action-top">
          <Pill tone={URGENCY_TONE[action.urgency]} dot>
            {URGENCY_LABEL[action.urgency]}
          </Pill>
          <span className="action-subject">{action.subject}</span>
        </div>
        <div className="action-sub-row">
          <div>
            <div className="lbl">Responsible</div>
            <div className="val">{action.responsible}</div>
          </div>
          <div>
            <div className="lbl">Next action</div>
            <div className="val">{action.nextAction}</div>
          </div>
          <div>
            <div className="lbl">Due</div>
            <div className="val">{action.dueDate ? formatDate(action.dueDate) : "—"}</div>
          </div>
        </div>
      </div>
      <div className="action-cta">
        <span style={{ color: "var(--brand)", fontWeight: 600, fontSize: 13 }}>Open →</span>
      </div>
    </div>
  );
}

export function ActionStream({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return (
      <div className="state">
        <div className="state-ico">✓</div>
        <h4>You're all clear</h4>
        <p style={{ margin: "4px 0 0" }}>Nothing needs your attention right now.</p>
      </div>
    );
  }
  return (
    <div className="stream">
      {actions.map((a) => (
        <ActionCard key={a.id} action={a} />
      ))}
    </div>
  );
}
