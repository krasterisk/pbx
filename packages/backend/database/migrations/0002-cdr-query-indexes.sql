CREATE INDEX idx_cdr_tenant_date ON cdr (vpbx_user_uid, calldate, uniqueid);
CREATE INDEX idx_cdr_tenant_linked_date ON cdr (vpbx_user_uid, linkedid, calldate, uniqueid);
