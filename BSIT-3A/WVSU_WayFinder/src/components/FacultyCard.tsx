import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { mappableOfficeId } from "../lib/faculty";
import type { Faculty } from "../lib/types";
import { PinIcon } from "./Icons";
import { DataBadge } from "./PlaceCard";

/** Compact teacher row for the directory list. */
export function FacultyRow({
  faculty: f,
  active,
  to,
}: {
  faculty: Faculty;
  active?: boolean;
  to?: string;
}) {
  return (
    <Link
      to={to ?? `/directory/faculty/${encodeURIComponent(f.id)}`}
      className={`card dir-row${active ? " active" : ""}`}
      aria-label={f.fullName}
    >
      <span className="kind">
        Faculty{f.collegeCode ? ` · ${f.collegeCode}` : ""}
      </span>

      <span className="place-name">{f.fullName}</span>

      {(f.positionTitle || f.department) && (
        <span className="muted small">
          {[f.positionTitle, f.department]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </Link>
  );
}

/** Formats service hours without modifying the original database value. */
function formatServiceHours(value: string) {
  const isGeneral = /general university service hours/i.test(value);
  const noNoonBreak = /no noon break/i.test(value);
  const consultationVaries =
    /faculty consultation schedules may vary|individual faculty consultation times may vary/i.test(
      value
    );

  const schedule = value
    .replace(
      /\([^)]*(?:general university service hours|no noon break|faculty consultation schedules may vary|individual faculty consultation times may vary)[^)]*\)/gi,
      ""
    )
    .replace(/\bMonday\b/gi, "Mon")
    .replace(/\bTuesday\b/gi, "Tue")
    .replace(/\bWednesday\b/gi, "Wed")
    .replace(/\bThursday\b/gi, "Thu")
    .replace(/\bFriday\b/gi, "Fri")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/[;,.\s]+$/, "")
    .trim();

  const generalNotes = [
    isGeneral ? "General university service hours" : null,
    noNoonBreak ? "no noon break" : null,
  ].filter(Boolean);

  const note = [
    generalNotes.length ? `${generalNotes.join("; ")}.` : "",
    consultationVaries
      ? "Individual faculty consultation times may vary."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { schedule, note };
}

/** Full faculty profile details. */
export default function FacultyCard({
  faculty: f,
}: {
  faculty: Faculty;
}) {
  const mapId = mappableOfficeId(f);

  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");

  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (copyTimeout.current !== null) {
        window.clearTimeout(copyTimeout.current);
      }
    };
  }, []);

  const copyEmail = async () => {
    if (!f.officialEmail) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(f.officialEmail);

      setCopyStatus("copied");

      if (copyTimeout.current !== null) {
        window.clearTimeout(copyTimeout.current);
      }

      copyTimeout.current = window.setTimeout(() => {
        setCopyStatus("idle");
        copyTimeout.current = null;
      }, 2000);
    } catch {
      setCopyStatus("error");

      if (copyTimeout.current !== null) {
        window.clearTimeout(copyTimeout.current);
      }

      copyTimeout.current = window.setTimeout(() => {
        setCopyStatus("idle");
        copyTimeout.current = null;
      }, 3500);
    }
  };

  const gmailUrl = f.officialEmail
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        f.officialEmail
      )}`
    : undefined;

  const serviceHours = f.officeHours
    ? formatServiceHours(f.officeHours)
    : null;

  return (
    <article
      className="card place-card faculty-profile"
      aria-label={`Faculty profile: ${f.fullName}`}
    >
      {/* Profile heading */}
      <div className="card-head">
        <span className="kind">Faculty</span>
        <DataBadge status={f.isDemo ? "demo" : "verified"} />
      </div>

      <h1 className="place-name detail-name">
        {f.fullName}
      </h1>

      {/* Faculty information */}
      <dl className="facts faculty-facts">
        {f.positionTitle && (
          <div>
            <dt>Position</dt>
            <dd>{f.positionTitle}</dd>
          </div>
        )}

        {f.department && (
          <div>
            <dt>Department</dt>
            <dd>{f.department}</dd>
          </div>
        )}

        {f.collegeUnit && (
          <div>
            <dt>College</dt>
            <dd>
              {f.collegeUnit}
              {f.collegeCode ? ` (${f.collegeCode})` : ""}
            </dd>
          </div>
        )}

        {/* Official email */}
        {f.officialEmail && (
          <div>
            <dt>Email</dt>

            <dd className="faculty-email-value">
              <a
                className="inline-link faculty-email-link"
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open Gmail to email ${f.fullName}`}
                title="Open Gmail compose"
              >
                {f.officialEmail}
              </a>

              <button
                type="button"
                className={`copy-email-btn${
                  copyStatus === "copied" ? " is-copied" : ""
                }`}
                onClick={copyEmail}
                aria-label={
                  copyStatus === "copied"
                    ? "Email address copied"
                    : "Copy faculty email address"
                }
              >
                {copyStatus === "copied"
                  ? "Copied!"
                  : "Copy"}
              </button>

              {copyStatus === "error" && (
                <span
                  className="copy-email-status"
                  role="status"
                  aria-live="polite"
                >
                  Unable to copy. Please select the email manually.
                </span>
              )}
            </dd>
          </div>
        )}

        {/* Service hours */}
        {serviceHours && (
          <div>
            <dt>Service Hours</dt>

            <dd className="faculty-service-hours">
              <strong className="faculty-service-schedule">
                {serviceHours.schedule}
              </strong>

              {serviceHours.note && (
                <span className="faculty-service-note">
                  {serviceHours.note}
                </span>
              )}
            </dd>
          </div>
        )}

        {/* Office information */}
        {f.office && (
          <div>
            <dt>Office</dt>
            <dd>
              {[
                f.office.name,
                f.office.parent?.name,
                f.office.floor !== undefined
                  ? `Floor ${f.office.floor}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
      </dl>

      {/* Map availability */}
      {mapId ? (
        <div className="actions">
          <Link
            className="btn primary"
            to={`/map?to=${encodeURIComponent(mapId)}`}
          >
            <PinIcon />
            View on Map
          </Link>
        </div>
      ) : (
        <div
          className="faculty-location-note"
          role="note"
        >
          <PinIcon />
          <span>Office location not yet confirmed</span>
        </div>
      )}
    </article>
  );
}