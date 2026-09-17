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


-- =========================================================
-- 11. FUNCTION TO MODERATE REVIEWS
-- - photographers can only approve or reject reviews for their own bookings
-- - changing the rating or review text is not allowed
-- =========================================================

CREATE OR REPLACE FUNCTION public.moderate_review(
    p_review_id uuid,
    p_status public.review_status
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_review public.reviews;
    v_photographer_id uuid;
BEGIN
    -- Only moderation outcomes are accepted.
    IF p_status NOT IN (
        'approved'::public.review_status,
        'rejected'::public.review_status
    ) THEN
        RAISE EXCEPTION 'Invalid review moderation status';
    END IF;

    -- Find the photographer belonging to the authenticated user.
    SELECT pp.photographer_id
    INTO v_photographer_id
    FROM public.photographer_profiles pp
    WHERE pp.user_id = (SELECT auth.uid())
    LIMIT 1;

    IF v_photographer_id IS NULL THEN
        RAISE EXCEPTION 'Photographer profile not found';
    END IF;

    -- Update only the moderation status.
    UPDATE public.reviews
    SET status = p_status
    WHERE review_id = p_review_id
      AND photographer_id = v_photographer_id
    RETURNING *
    INTO v_review;

    IF v_review.review_id IS NULL THEN
        RAISE EXCEPTION 'Review not found or access denied';
    END IF;

    RETURN v_review;
END;
$$;

-- =========================================================
-- 12. REVOKE PUBLIC EXECUTE ON FUNCTION public.moderate_review
-- =========================================================

REVOKE ALL ON FUNCTION public.moderate_review(
    uuid,
    public.review_status
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.moderate_review(
    uuid,
    public.review_status
) TO authenticated;

-- =========================================================
-- 13. DROP OLD POLICY FOR PHOTOGRAPHERS TO MODERATE AND DELETE THEIR REVIEWS
-- =========================================================

DROP POLICY IF EXISTS
"Photographers can moderate their reviews"
ON public.reviews;

DROP POLICY IF EXISTS
"Photographers can delete their reviews"
ON public.reviews;


-- =========================================================
-- 14. FUNCTION TO GET PUBLIC REVIEWS FOR A PHOTOGRAPHER
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_reviews(
    p_photographer_id uuid
)
RETURNS TABLE (
    review_id uuid,
    photographer_id uuid,
    rating smallint,
    comment text,
    created_at timestamptz,
    display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        r.review_id,
        r.photographer_id,
        r.rating,
        r.comment,
        r.created_at,

        CASE
            WHEN NULLIF(TRIM(p.first_name), '') IS NULL
                THEN 'Photography Client'

            WHEN NULLIF(TRIM(p.last_name), '') IS NULL
                THEN TRIM(p.first_name)

            ELSE
                TRIM(p.first_name)
                || ' '
                || UPPER(LEFT(TRIM(p.last_name), 1))
                || '.'
        END AS display_name

    FROM public.reviews r

    JOIN public.clients c
        ON c.client_id = r.client_id

    JOIN public.profiles p
        ON p.user_id = c.user_id

    WHERE r.photographer_id = p_photographer_id
      AND r.status = 'approved'::public.review_status

    ORDER BY r.created_at DESC;
$$;


-- =========================================================
-- 15. REVOKE PUBLIC EXECUTE ON FUNCTION public.get_public_reviews
-- =========================================================

REVOKE ALL ON FUNCTION public.get_public_reviews(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_reviews(uuid)
TO anon, authenticated;


-- =========================================================
-- 16. ADD UNIQUE CONSTRAINT TO ENSURE A CLIENT CAN ONLY REVIEW A PHOTOGRAPHER ONCE PER BOOKING
-- =========================================================

ALTER TABLE public.reviews
ADD CONSTRAINT reviews_photographer_review_unique
UNIQUE (photographer_id, review_id);


-- =========================================================
-- 17. CREATE TABLE FOR FEATURED REVIEWS ON PHOTOGRAPHER WEBSITE
-- =========================================================

CREATE TABLE public.website_featured_reviews (
    photographer_id uuid NOT NULL,
    review_id uuid NOT NULL,
    display_order smallint NOT NULL,

    CONSTRAINT website_featured_reviews_pkey
        PRIMARY KEY (photographer_id, review_id),

    CONSTRAINT website_featured_reviews_photographer_fk
        FOREIGN KEY (photographer_id)
        REFERENCES public.photographer_profiles(photographer_id)
        ON DELETE CASCADE,

    CONSTRAINT website_featured_reviews_review_fk
        FOREIGN KEY (photographer_id, review_id)
        REFERENCES public.reviews(photographer_id, review_id)
        ON DELETE CASCADE,

    CONSTRAINT website_featured_reviews_order_check
        CHECK (display_order BETWEEN 1 AND 3),

    CONSTRAINT website_featured_reviews_order_unique
        UNIQUE (photographer_id, display_order)
);


-- =========================================================
-- 18. ENABLE ROW LEVEL SECURITY ON FEATURED REVIEWS TABLE
-- =========================================================

ALTER TABLE public.website_featured_reviews
ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 19. CREATE POLICIES FOR PHOTOGRAPHERS TO MANAGE THEIR FEATURED REVIEWS
-- =========================================================

CREATE POLICY "Photographers can view their featured reviews"
ON public.website_featured_reviews
FOR SELECT
TO authenticated
USING (
    photographer_id =
    (SELECT private.current_photographer_id())
);

CREATE POLICY "Photographers can add their featured reviews"
ON public.website_featured_reviews
FOR INSERT
TO authenticated
WITH CHECK (
    photographer_id =
    (SELECT private.current_photographer_id())
);

CREATE POLICY "Photographers can update their featured reviews"
ON public.website_featured_reviews
FOR UPDATE
TO authenticated
USING (
    photographer_id =
    (SELECT private.current_photographer_id())
)
WITH CHECK (
    photographer_id =
    (SELECT private.current_photographer_id())
);

CREATE POLICY "Photographers can remove their featured reviews"
ON public.website_featured_reviews
FOR DELETE
TO authenticated
USING (
    photographer_id =
    (SELECT private.current_photographer_id())
);


-- =========================================================
-- 20. CREATE FUNCTION TO VALIDATE FEATURED REVIEWS
-- =========================================================

CREATE OR REPLACE FUNCTION private.validate_featured_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.reviews r
        WHERE r.review_id = NEW.review_id
          AND r.photographer_id = NEW.photographer_id
          AND r.status = 'approved'::public.review_status
    ) THEN
        RAISE EXCEPTION
            'Only approved reviews belonging to this photographer can be featured';
    END IF;

    RETURN NEW;
END;
$$;


-- =========================================================
-- 21. CREATE TRIGGER TO VALIDATE FEATURED REVIEWS
-- =========================================================

CREATE TRIGGER validate_website_featured_review
BEFORE INSERT OR UPDATE
ON public.website_featured_reviews
FOR EACH ROW
EXECUTE FUNCTION private.validate_featured_review();


-- =========================================================
-- 22. CREATE FUNCTION TO REMOVE UNPUBLISHED FEATURED REVIEWS
-- =========================================================

CREATE OR REPLACE FUNCTION private.remove_unpublished_featured_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.status = 'approved'::public.review_status
       AND NEW.status <> 'approved'::public.review_status
    THEN
        DELETE FROM public.website_featured_reviews
        WHERE review_id = NEW.review_id
          AND photographer_id = NEW.photographer_id;
    END IF;

    RETURN NEW;
END;
$$;


-- =========================================================
-- 23. CREATE TRIGGER TO REMOVE UNPUBLISHED FEATURED REVIEWS
-- =========================================================

CREATE TRIGGER remove_unpublished_featured_review
AFTER UPDATE OF status
ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION private.remove_unpublished_featured_review();


-- =========================================================
-- 24. CREATE FUNCTION TO GET FEATURED REVIEWS FOR A PHOTOGRAPHER
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_featured_reviews(
    p_photographer_id uuid
)
RETURNS TABLE (
    review_id uuid,
    photographer_id uuid,
    rating smallint,
    comment text,
    created_at timestamptz,
    display_name text,
    display_order smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        r.review_id,
        r.photographer_id,
        r.rating,
        r.comment,
        r.created_at,

        CASE
            WHEN NULLIF(TRIM(p.first_name), '') IS NULL
                THEN 'Photography Client'

            WHEN NULLIF(TRIM(p.last_name), '') IS NULL
                THEN TRIM(p.first_name)

            ELSE
                TRIM(p.first_name)
                || ' '
                || UPPER(LEFT(TRIM(p.last_name), 1))
                || '.'
        END AS display_name,

        f.display_order

    FROM public.website_featured_reviews f

    JOIN public.reviews r
        ON r.review_id = f.review_id
       AND r.photographer_id = f.photographer_id

    JOIN public.clients c
        ON c.client_id = r.client_id

    JOIN public.profiles p
        ON p.user_id = c.user_id

    WHERE f.photographer_id = p_photographer_id
      AND r.status = 'approved'::public.review_status

    ORDER BY f.display_order ASC

    LIMIT 3;
$$;


-- =========================================================
-- 25. REVOKE PUBLIC EXECUTE ON FUNCTION public.get_featured_reviews
-- =========================================================

REVOKE ALL ON FUNCTION public.get_featured_reviews(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_featured_reviews(uuid)
TO anon, authenticated;


-- =========================================================
-- 26. UPDATE POLICY FOR CLIENTS TO CREATE REVIEWS
-- =========================================================

DROP POLICY IF EXISTS
"Clients can create reviews"
ON public.reviews;

CREATE POLICY
"Clients can create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
    client_id = (SELECT private.current_client_id())

    AND status = 'pending'::public.review_status

    AND EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.booking_id = reviews.booking_id
          AND b.client_id = reviews.client_id
          AND b.photographer_id = reviews.photographer_id
          AND b.client_id = (SELECT private.current_client_id())
          AND b.status = 'completed'::public.booking_status
    )
);


-- =========================================================
-- 27. CREATE FUNCTION FOR CLIENTS TO UPDATE THEIR PENDING REVIEWS
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_pending_review(
    p_review_id uuid,
    p_rating smallint,
    p_comment text
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_review public.reviews;
    v_client_id uuid;
BEGIN
    -- Validate rating explicitly.
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    -- Identify the currently authenticated client.
    SELECT c.client_id
    INTO v_client_id
    FROM public.clients c
    WHERE c.user_id = (SELECT auth.uid())
    LIMIT 1;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Client profile not found';
    END IF;

    -- Update only fields that a client is allowed to edit.
    UPDATE public.reviews
    SET
        rating = p_rating,
        comment = NULLIF(BTRIM(p_comment), '')
    WHERE review_id = p_review_id
      AND client_id = v_client_id
      AND status = 'pending'::public.review_status
    RETURNING *
    INTO v_review;

    IF v_review.review_id IS NULL THEN
        RAISE EXCEPTION
            'Review not found, access denied, or review is no longer pending';
    END IF;

    RETURN v_review;
END;
$$;

REVOKE ALL
ON FUNCTION public.update_pending_review(uuid, smallint, text)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.update_pending_review(uuid, smallint, text)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.update_pending_review(uuid, smallint, text)
TO authenticated;


-- =========================================================
-- 28. DROP OLD POLICY FOR CLIENTS TO UPDATE THEIR REVIEWS
-- =========================================================

DROP POLICY IF EXISTS
"Clients can update their own reviews"
ON public.reviews;