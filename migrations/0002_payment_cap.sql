CREATE TRIGGER payment_received_cap BEFORE UPDATE ON payment_terms
WHEN json_extract(NEW.data, '$.received') > json_extract(NEW.data, '$.amount')
BEGIN
  SELECT RAISE(ABORT, 'payment exceeds outstanding amount');
END;
