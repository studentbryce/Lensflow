-- ============================================================================
-- LensFlow V1 - Edits to Supabase Database Recovery / Migration Schema
-- ============================================================================

-- ============================================================================
-- Add Policy for Photographers to upload media to their website
-- ===========================================================================

CREATE POLICY "Photographers can upload website media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photographer-website-media'

  AND array_length(
    storage.foldername(storage.objects.name),
    1
  ) >= 2

  AND (
    storage.foldername(storage.objects.name)
  )[2] IN ('hero', 'about')

  AND EXISTS (
    SELECT 1
    FROM public.photographer_profiles pp
    WHERE pp.photographer_id =
      (
        (
          storage.foldername(
            storage.objects.name
          )
        )[1]
      )::uuid
      AND pp.user_id = auth.uid()
  )
);

-- ============================================================================
-- Add Policy for Photographers to update media on their website
-- ===========================================================================

CREATE POLICY "Photographers can update website media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photographer-website-media'

  AND array_length(
    storage.foldername(storage.objects.name),
    1
  ) >= 2

  AND (
    storage.foldername(storage.objects.name)
  )[2] IN ('hero', 'about')

  AND EXISTS (
    SELECT 1
    FROM public.photographer_profiles pp
    WHERE pp.photographer_id =
      (
        (
          storage.foldername(
            storage.objects.name
          )
        )[1]
      )::uuid
      AND pp.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'photographer-website-media'

  AND array_length(
    storage.foldername(storage.objects.name),
    1
  ) >= 2

  AND (
    storage.foldername(storage.objects.name)
  )[2] IN ('hero', 'about')

  AND EXISTS (
    SELECT 1
    FROM public.photographer_profiles pp
    WHERE pp.photographer_id =
      (
        (
          storage.foldername(
            storage.objects.name
          )
        )[1]
      )::uuid
      AND pp.user_id = auth.uid()
  )
);

-- ===========================================================================
-- Add Policy for Photographers to delete media from their website
-- ===========================================================================

CREATE POLICY "Photographers can delete website media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photographer-website-media'

  AND array_length(
    storage.foldername(storage.objects.name),
    1
  ) >= 2

  AND (
    storage.foldername(storage.objects.name)
  )[2] IN ('hero', 'about')

  AND EXISTS (
    SELECT 1
    FROM public.photographer_profiles pp
    WHERE pp.photographer_id =
      (
        (
          storage.foldername(
            storage.objects.name
          )
        )[1]
      )::uuid
      AND pp.user_id = auth.uid()
  )
);

-- ===========================================================================
-- Add Policy for Photographers to view media on their website
-- ===========================================================================

CREATE POLICY "Photographers can view their website media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'photographer-website-media'

  AND array_length(
    storage.foldername(storage.objects.name),
    1
  ) >= 2

  AND (
    storage.foldername(storage.objects.name)
  )[2] IN ('hero', 'about')

  AND EXISTS (
    SELECT 1
    FROM public.photographer_profiles pp
    WHERE pp.photographer_id =
      (
        (
          storage.foldername(
            storage.objects.name
          )
        )[1]
      )::uuid
      AND pp.user_id = auth.uid()
  )
);


-- ===========================================================================
-- Update website settings table to include font options for heading, body, 
-- and navigation
-- ===========================================================================

ALTER TABLE public.website_settings
ADD COLUMN heading_font varchar(100),
ADD COLUMN body_font varchar(100),
ADD COLUMN navigation_font varchar(100);

-- ===========================================================================
-- Update existing records to set heading_font, body_font, and navigation_font 
-- to font_family if they are NULL
-- ===========================================================================

UPDATE public.website_settings
SET
    heading_font = COALESCE(heading_font, font_family),
    body_font = COALESCE(body_font, font_family),
    navigation_font = COALESCE(navigation_font, font_family)
WHERE font_family IS NOT NULL;




-- =========================================================
-- LENSFLOW MESSAGING V1 SECURITY + REALTIME MIGRATION
-- =========================================================


-- =========================================================
-- 1. REMOVE MESSAGE EDIT / DELETE POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can update their own messages"
ON public.messages;

DROP POLICY IF EXISTS
"Users can delete their own messages"
ON public.messages;


-- =========================================================
-- 2. REMOVE DIRECT CONVERSATION UPDATE
-- =========================================================
--
-- There currently aren't any user-editable conversation
-- fields. updated_at will be maintained automatically.
--

DROP POLICY IF EXISTS
"Photographers can update conversations"
ON public.conversations;


-- =========================================================
-- 3. ALLOW RECIPIENT TO UPDATE MESSAGE READ STATE
-- =========================================================

CREATE POLICY
"Recipients can mark messages read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
    sender_id <> auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.conversation_id =
              messages.conversation_id
        AND (
            c.photographer_id =
                private.current_photographer_id()
            OR
            c.client_id =
                private.current_client_id()
        )
    )
)
WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.conversation_id =
              messages.conversation_id
        AND (
            c.photographer_id =
                private.current_photographer_id()
            OR
            c.client_id =
                private.current_client_id()
        )
    )
);


-- =========================================================
-- 4. PREVENT MESSAGE CONTENT FROM BEING MODIFIED
-- =========================================================
--
-- Even though the recipient has UPDATE permission,
-- they should only be able to change is_read.
--

CREATE OR REPLACE FUNCTION private.protect_message_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN

    -- Message identity cannot change.

    IF NEW.message_id IS DISTINCT FROM OLD.message_id THEN
        RAISE EXCEPTION
            'message_id cannot be changed';
    END IF;


    -- Conversation cannot change.

    IF NEW.conversation_id
        IS DISTINCT FROM OLD.conversation_id
    THEN
        RAISE EXCEPTION
            'conversation_id cannot be changed';
    END IF;


    -- Sender cannot change.

    IF NEW.sender_id
        IS DISTINCT FROM OLD.sender_id
    THEN
        RAISE EXCEPTION
            'sender_id cannot be changed';
    END IF;


    -- Sent message content cannot be edited.

    IF NEW.message
        IS DISTINCT FROM OLD.message
    THEN
        RAISE EXCEPTION
            'sent messages cannot be edited';
    END IF;


    -- Original timestamp cannot change.

    IF NEW.created_at
        IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'created_at cannot be changed';
    END IF;


    -- Once read, a message cannot become unread again.

    IF OLD.is_read = true
       AND NEW.is_read = false
    THEN
        RAISE EXCEPTION
            'read messages cannot be marked unread';
    END IF;


    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS
protect_message_update_trigger
ON public.messages;

CREATE TRIGGER
protect_message_update_trigger
BEFORE UPDATE
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION
private.protect_message_update();


-- =========================================================
-- 5. UPDATE CONVERSATION TIMESTAMP WHEN MESSAGE IS SENT
-- =========================================================
--
-- This lets the inbox order conversations by most
-- recently active conversation.
--

CREATE OR REPLACE FUNCTION private.touch_conversation_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

    UPDATE public.conversations
    SET updated_at = NEW.created_at
    WHERE conversation_id =
          NEW.conversation_id;

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS
touch_conversation_on_message_insert
ON public.messages;

CREATE TRIGGER
touch_conversation_on_message_insert
AFTER INSERT
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION
private.touch_conversation_from_message();


-- =========================================================
-- 6. INDEX UNREAD MESSAGES
-- =========================================================

CREATE INDEX IF NOT EXISTS
idx_messages_unread
ON public.messages (
    conversation_id,
    sender_id,
    created_at DESC
)
WHERE is_read = false;


-- =========================================================
-- 7. ENABLE REALTIME FOR MESSAGES
-- =========================================================

ALTER PUBLICATION supabase_realtime
ADD TABLE public.messages;

-- =========================================================
-- 8. CLIENTS CAN VIEW THEIR ASSIGNED PHOTOGRAPHER
-- =========================================================

DROP POLICY IF EXISTS
"Clients can view their photographer profile"
ON public.photographer_profiles;


CREATE POLICY
"Clients can view their photographer profile"
ON public.photographer_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE
            c.photographer_id =
                photographer_profiles.photographer_id
        AND c.user_id = auth.uid()
    )
);

-- =========================================================
-- 9. CLIENTS CAN VIEW THEIR PHOTOGRAPHER AVAILABILITY RULES
-- =========================================================

CREATE POLICY "Clients can view their photographer availability rules"
ON public.availability_rules
FOR SELECT
TO authenticated
USING (
    photographer_id = (
        SELECT c.photographer_id
        FROM public.clients c
        WHERE c.client_id = (
            SELECT private.current_client_id()
        )
        LIMIT 1
    )
);

-- =========================================================
-- 10. CLIENTS CAN VIEW THEIR PHOTOGRAPHER AVAILABILITY EXCEPTIONS  
-- =========================================================


CREATE POLICY "Clients can view their photographer availability exceptions"
ON public.availability_exceptions
FOR SELECT
TO authenticated
USING (
    photographer_id = (
        SELECT c.photographer_id
        FROM public.clients c
        WHERE c.client_id = (
            SELECT private.current_client_id()
        )
        LIMIT 1
    )
);