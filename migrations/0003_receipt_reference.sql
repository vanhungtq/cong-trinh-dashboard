CREATE UNIQUE INDEX receipts_project_reference ON receipts(project_id, json_extract(data, '$.reference') COLLATE NOCASE);
