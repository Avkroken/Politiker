-- Generalize the shared public recipient registry before adding academic contacts.
-- Existing IDs and recipient verification state are preserved.

ALTER TABLE politicians RENAME TO public_contacts;
ALTER TABLE politician_assignments RENAME TO public_contact_assignments;
ALTER TABLE public_contact_assignments RENAME COLUMN politician_id TO contact_id;

ALTER TABLE public_contacts ADD COLUMN organisation TEXT;
ALTER TABLE public_contacts ADD COLUMN unit TEXT;
ALTER TABLE public_contacts ADD COLUMN title TEXT;
ALTER TABLE public_contacts ADD COLUMN academic_field TEXT;
ALTER TABLE public_contacts ADD COLUMN source_url TEXT;

DROP INDEX IF EXISTS idx_politicians_area;
DROP INDEX IF EXISTS idx_politicians_area_role;
DROP INDEX IF EXISTS idx_politicians_role;
DROP INDEX IF EXISTS idx_politicians_email_normalized;
DROP INDEX IF EXISTS idx_politician_assignments_politician;
DROP INDEX IF EXISTS idx_politician_assignments_area_body;

CREATE INDEX idx_public_contacts_area ON public_contacts(area_type, area_name);
CREATE INDEX idx_public_contacts_area_role ON public_contacts(area_name, role);
CREATE INDEX idx_public_contacts_role ON public_contacts(role);
CREATE INDEX idx_public_contacts_email_normalized ON public_contacts(lower(trim(email)));
CREATE INDEX idx_public_contacts_academic_field ON public_contacts(area_type, academic_field);
CREATE INDEX idx_public_contact_assignments_contact ON public_contact_assignments(contact_id);
CREATE INDEX idx_public_contact_assignments_area_body ON public_contact_assignments(area_name, body);
