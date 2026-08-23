#!/usr/bin/env python3
"""
Bounce processor för politiker.
Läser studsade mail från Gmail IMAP och markerar endast verifierat permanent
ogiltiga adresser i Cloudflare D1.
Körs av systemd-timer (se bounce-processor.timer).
"""
import imaplib
import json
import logging
import os
import re
import sys
import urllib.request
from email import policy
from email.parser import BytesParser
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s bounce-processor %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger()

ENV_FILE = Path(__file__).resolve().with_name(".env")
CF_ACCOUNT_ID = "b74f8c0c6a92f3006483840cf27372fd"
CF_DB_ID = "78777055-bf37-4388-86ad-69bdf782e2cd"


def load_env():
    env = dict(os.environ)
    if ENV_FILE.exists():
        with ENV_FILE.open() as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


SKIP_DOMAINS = {
    "denied.se", "icloud.com", "apple.com", "microsoft.com", "google.com",
    "gmail.com", "hotmail.com", "live.com", "outlook.com", "yahoo.com",
    "telia.com", "tele2.com", "comhem.se",
}
SKIP_PATTERNS = [
    r"\.prod\.outlook\.com$", r"\.swep\d+\.", r"\.eurprd\d+\.",
    r"outbound\.", r"^mailer-daemon@", r"^postmaster@",
    r"^[0-9a-f]{20,}@", r"@[0-9a-f]{20,}\.",
]

TRANSIENT_FAILURE_TERMS = (
    "mailbox full",
    "mailbox is full",
    "quota exceeded",
    "over quota",
    "temporarily",
    "temporary failure",
    "try again",
    "rate limit",
    "throttl",
    "greylist",
    "too many messages",
    "resources temporarily unavailable",
    "insufficient system storage",
)
PERMANENT_ADDRESS_TERMS = (
    "user unknown",
    "unknown user",
    "no such user",
    "no such recipient",
    "recipient not found",
    "mailbox does not exist",
    "invalid recipient",
    "recipient address rejected",
    "address rejected",
    "recipient rejected",
)
ADDRESS_RE = re.compile(r"[\w.+%-]+@[\w.\-]+\.\w+", re.I)
STATUS_RE = re.compile(r"\b([245]\.\d{1,3}\.\d{1,3})\b")


def is_politician_addr(addr):
    addr = addr.lower()
    domain = addr.split("@", 1)[-1] if "@" in addr else ""
    if domain in SKIP_DOMAINS:
        return False
    for p in SKIP_PATTERNS:
        if re.search(p, addr, re.I):
            return False
    local = addr.split("@")[0]
    return bool(re.search(r"[a-zA-ZåäöÅÄÖ.-]", local)) and len(local) > 2


def classify_delivery_failure(status="", diagnostic="", action=""):
    """Returnerar (permanent, orsak).

    Vi är avsiktligt konservativa: endast adressrelaterade permanenta fel
    sanerar registret. Policy-/spamfel, kvotproblem och alla 4.x.x lämnas kvar.
    """
    status = (status or "").strip().lower()
    diagnostic = (diagnostic or "").strip()
    text = f"{action or ''} {diagnostic}".lower()

    if any(term in text for term in TRANSIENT_FAILURE_TERMS):
        return False, status or "temporärt leveransfel"
    if status.startswith("4."):
        return False, status
    if status.startswith("5.1."):
        return True, status
    if any(term in text for term in PERMANENT_ADDRESS_TERMS):
        return True, status or "permanent adressavvisning"
    return False, status or "oklassificerat leveransfel"


def _recipient_from_header(value):
    if not value:
        return None
    match = ADDRESS_RE.search(str(value))
    return match.group(0).lower() if match else None


def _add_result(results, addr, status="", diagnostic="", action=""):
    if not addr or not is_politician_addr(addr):
        return
    permanent, reason = classify_delivery_failure(status, diagnostic, action)
    if not permanent:
        return
    current = results.get(addr)
    candidate = {
        "status": status or reason,
        "diagnostic": diagnostic.strip(),
        "reason": reason,
    }
    # Föredra DSN-resultat med explicit status framför textfallback.
    if current is None or (status and not current.get("status")):
        results[addr] = candidate


def extract_permanent_bounces(raw_bytes):
    """Returnerar {adress: metadata} endast för säkert permanenta studs."""
    results = {}

    try:
        message = BytesParser(policy=policy.default).parsebytes(raw_bytes)
    except Exception:
        message = None

    # RFC 3464 message/delivery-status är den säkraste källan eftersom status
    # och mottagare hör ihop i samma recipient-block.
    if message is not None:
        for part in message.walk():
            if part.get_content_type() != "message/delivery-status":
                continue
            payload = part.get_payload()
            blocks = payload if isinstance(payload, list) else [part]
            for block in blocks:
                if not hasattr(block, "get"):
                    continue
                addr = _recipient_from_header(
                    block.get("Final-Recipient") or block.get("Original-Recipient")
                )
                status = str(block.get("Status") or "").strip()
                diagnostic = str(block.get("Diagnostic-Code") or "").strip()
                action = str(block.get("Action") or "").strip()
                _add_result(results, addr, status, diagnostic, action)

    full = raw_bytes.decode(errors="ignore")

    # Fallback för leverantörer som skickar NDR som vanlig text/HTML. En adress
    # godtas bara om dess lokala textfönster också innehåller tydlig permanent
    # adressstatus eller permanent adressdiagnostik.
    for match in ADDRESS_RE.finditer(full):
        addr = match.group(0).lower()
        if addr in results or not is_politician_addr(addr):
            continue
        start = max(0, match.start() - 700)
        end = min(len(full), match.end() + 700)
        context = full[start:end]
        statuses = STATUS_RE.findall(context)
        status = next((s for s in statuses if s.startswith("5.1.")), statuses[0] if statuses else "")
        _add_result(results, addr, status, context)

    return results


def extract_bounced_addresses(raw_bytes):
    """Bakåtkompatibel wrapper: endast permanenta studsade adresser."""
    return set(extract_permanent_bounces(raw_bytes))


def mark_dead_in_d1(addresses, cf_token):
    if not addresses:
        return 0
    normalized = sorted({a.strip().lower() for a in addresses if a.strip()})
    placeholders = ",".join("?" for _ in normalized)
    sql = (
        "UPDATE politicians SET verification_status='dead_via_send', "
        "last_verified_at=strftime('%s','now')*1000 "
        f"WHERE lower(trim(email)) IN ({placeholders})"
    )
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DB_ID}/query"
    body = json.dumps({"sql": sql, "params": normalized}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {cf_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    if not data.get("success"):
        raise RuntimeError(f"D1 API error: {data.get('errors')}")
    return data["result"][0]["meta"].get("changes", 0)


def main():
    env = load_env()
    cf_token = env.get("CLOUDFLARE_API_TOKEN_POLITIKER")
    imap_user = env.get("GMAIL_EMAIL")
    imap_pw = env.get("GMAIL_PASSWORD")
    if not cf_token:
        log.error("CLOUDFLARE_API_TOKEN_POLITIKER saknas")
        sys.exit(1)
    if not imap_user or not imap_pw:
        log.error("GMAIL_EMAIL / GMAIL_PASSWORD saknas")
        sys.exit(1)

    mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    mail.login(imap_user, imap_pw)

    permanent_bounces = {}

    for folder in ["INBOX", "[Gmail]/Spam"]:
        status, _ = mail.select(folder)
        if status != "OK":
            continue

        # UNSEEN gör behandlingen idempotent på inkorgsnivå.
        _, data = mail.search(
            None,
            '(UNSEEN OR SUBJECT "Undeliverable" SUBJECT "Delivery Status Notification")',
        )
        if not data or not data[0]:
            continue
        seqnums = [s for s in data[0].split() if s]
        log.info("Mapp %s: %d olästa studs-mail", folder, len(seqnums))

        for seq in seqnums:
            _, fdata = mail.fetch(seq, "(BODY.PEEK[])")
            raw = next(
                (i[1] for i in fdata if isinstance(i, tuple) and isinstance(i[1], bytes)),
                next((i for i in fdata if isinstance(i, bytes) and len(i) > 200), None),
            )
            if not raw:
                continue

            results = extract_permanent_bounces(raw)
            for addr, meta in results.items():
                permanent_bounces[addr] = meta
                log.info(
                    "Permanent studs: %s status=%s orsak=%s",
                    addr,
                    meta.get("status") or "okänd",
                    meta.get("reason") or "okänd",
                )

            # Läs även temporära/oklassificerade NDR bara en gång; de påverkar
            # inte registret och ska inte återprocessas vid varje timerkörning.
            mail.store(seq, "+FLAGS", "\\Seen")

    mail.logout()

    if not permanent_bounces:
        log.info("Inga nya permanent studsade politikeradresser hittades")
        return

    addresses = set(permanent_bounces)
    log.info(
        "Sanerar %d verifierat permanent studsade adresser i D1: %s",
        len(addresses),
        addresses,
    )
    try:
        changed = mark_dead_in_d1(addresses, cf_token)
        log.info("D1 uppdaterade %d matchande kontaktposter", changed)
    except Exception as exc:
        log.error("D1-uppdatering misslyckades: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
