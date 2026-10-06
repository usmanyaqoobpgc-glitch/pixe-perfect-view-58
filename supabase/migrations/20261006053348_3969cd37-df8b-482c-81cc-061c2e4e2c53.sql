ALTER TABLE public.revenue_records ADD COLUMN IF NOT EXISTS source_type text, ADD COLUMN IF NOT EXISTS source_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS revenue_records_source_uniq ON public.revenue_records(source_type, source_id) WHERE source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.revenue_from_customer() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.lifetime_value,0) > 0 THEN
    INSERT INTO revenue_records(business_id,type,amount,description,category,record_date,is_estimate,source_type,source_id)
    VALUES (NEW.business_id,'revenue',NEW.lifetime_value,'New customer: '||NEW.name,'customer',CURRENT_DATE,false,'customer',NEW.id)
    ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_revenue AFTER INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.revenue_from_customer();

CREATE OR REPLACE FUNCTION public.revenue_from_lead() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'converted' AND OLD.status IS DISTINCT FROM 'converted' AND COALESCE(NEW.estimated_value,0) > 0 THEN
    INSERT INTO revenue_records(business_id,type,amount,description,category,record_date,is_estimate,source_type,source_id)
    VALUES (NEW.business_id,'revenue',NEW.estimated_value,'Deal won: '||NEW.name,'deal',CURRENT_DATE,false,'lead',NEW.id)
    ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_revenue AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.revenue_from_lead();