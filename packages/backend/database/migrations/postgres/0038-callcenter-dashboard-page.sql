-- cc-analytics E4: the call-center management dashboard becomes the first page of the Call Center hub.
-- Additive and idempotent: hub_module_pages is unique on (hub_code, page_code).
INSERT INTO hub_module_pages (hub_code, page_code, path, sort_order)
VALUES ('callcenter', 'cc_dashboard', '/callcenter/dashboard', 10)
ON CONFLICT (hub_code, page_code) DO NOTHING;
