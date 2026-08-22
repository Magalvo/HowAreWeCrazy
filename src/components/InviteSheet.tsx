import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "../i18n-context";
import { experienceLabel } from "../labels";
import type { RoomMode } from "../types";

export function InviteSheet({
  code,
  inviteUrl,
  mode,
  onClose,
  onCopy,
  onShare
}: {
  code: string;
  inviteUrl: string;
  mode: RoomMode | "competitive";
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#231d19",
        light: "#fffaf2"
      }
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  return (
    <div className="invite-backdrop" role="presentation" onClick={onClose}>
      <section className="invite-sheet" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(event) => event.stopPropagation()}>
        <div className="invite-heading">
          <div>
            <p className="eyebrow">{experienceLabel(mode)}</p>
            <h2 id="invite-title">{t("Invite players")}</h2>
          </div>
          <button className="ghost-button invite-close" type="button" onClick={onClose}>{t("Close")}</button>
        </div>
        <div className="qr-card">
          {qrDataUrl
            ? <img src={qrDataUrl} alt={t("QR code invite")} />
            : <div className="qr-placeholder" aria-hidden="true" />}
        </div>
        <p className="invite-code">{code}</p>
        <p className="invite-copy">{t("Scan this code or share the link so players can join from their own phones.")}</p>
        <div className="invite-actions">
          <button className="primary-button" type="button" onClick={onShare}>{t("Share")}</button>
          <button className="secondary-button" type="button" onClick={onCopy}>{t("Copy link")}</button>
        </div>
      </section>
    </div>
  );
}
