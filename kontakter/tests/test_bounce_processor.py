from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[2] / "infra" / "bounce-processor.py"
spec = spec_from_file_location("bounce_processor", MODULE_PATH)
bounce = module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(bounce)


def test_511_user_unknown_is_permanent():
    permanent, reason = bounce.classify_delivery_failure(
        "5.1.1", "smtp; 550 5.1.1 User unknown", "failed"
    )
    assert permanent is True
    assert reason == "5.1.1"


def test_422_mailbox_full_is_not_permanent():
    permanent, _ = bounce.classify_delivery_failure(
        "4.2.2", "smtp; 452 4.2.2 Mailbox full", "delayed"
    )
    assert permanent is False


def test_522_mailbox_full_is_not_permanent_even_with_5xx():
    permanent, _ = bounce.classify_delivery_failure(
        "5.2.2", "smtp; 552 5.2.2 Mailbox is full", "failed"
    )
    assert permanent is False


def test_571_policy_rejection_does_not_kill_contact():
    permanent, _ = bounce.classify_delivery_failure(
        "5.7.1", "smtp; 550 5.7.1 Message rejected by policy", "failed"
    )
    assert permanent is False


def test_rfc3464_extracts_only_permanent_recipient():
    raw = b"""From: MAILER-DAEMON@example.net\r\nTo: sender@example.org\r\nSubject: Delivery Status Notification\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status; boundary=dsn\r\n\r\n--dsn\r\nContent-Type: text/plain\r\n\r\nDelivery failed.\r\n--dsn\r\nContent-Type: message/delivery-status\r\n\r\nFinal-Recipient: rfc822; anna.andersson@kommun.se\r\nAction: failed\r\nStatus: 5.1.1\r\nDiagnostic-Code: smtp; 550 5.1.1 User unknown\r\n\r\nFinal-Recipient: rfc822; bo.berg@region.se\r\nAction: delayed\r\nStatus: 4.2.2\r\nDiagnostic-Code: smtp; 452 4.2.2 Mailbox full\r\n\r\n--dsn--\r\n"""
    results = bounce.extract_permanent_bounces(raw)
    assert set(results) == {"anna.andersson@kommun.se"}
    assert results["anna.andersson@kommun.se"]["status"] == "5.1.1"


def test_text_fallback_requires_permanent_evidence():
    permanent = b"Delivery failed for <eva.ek@kommun.se>: 550 5.1.1 No such recipient"
    temporary = b"Delivery delayed for <lisa.lind@kommun.se>: 452 4.2.2 Mailbox full"
    assert bounce.extract_bounced_addresses(permanent) == {"eva.ek@kommun.se"}
    assert bounce.extract_bounced_addresses(temporary) == set()
