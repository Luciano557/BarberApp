ALTER TABLE public.portal_config ADD COLUMN IF NOT EXISTS meta_pixel_id text;

CREATE OR REPLACE FUNCTION public.validate_portal_meta_pixel_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.meta_pixel_id IS NOT NULL THEN
    NEW.meta_pixel_id := btrim(NEW.meta_pixel_id);
    IF NEW.meta_pixel_id = '' THEN
      NEW.meta_pixel_id := NULL;
    ELSIF NEW.meta_pixel_id !~ '^[0-9]{10,20}$' THEN
      RAISE EXCEPTION 'meta_pixel_id invalido: debe contener solo digitos y tener entre 10 y 20 caracteres';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_portal_meta_pixel_id ON public.portal_config;
CREATE TRIGGER trg_validate_portal_meta_pixel_id
BEFORE INSERT OR UPDATE ON public.portal_config
FOR EACH ROW EXECUTE FUNCTION public.validate_portal_meta_pixel_id();