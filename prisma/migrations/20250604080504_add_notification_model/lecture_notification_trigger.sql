-- Create a function and trigger to automatically create notifications when new lectures are added
-- This file will be a migration file applied to the database

-- Create a notification creation function
CREATE OR REPLACE FUNCTION create_lecture_notifications()
RETURNS TRIGGER AS $$
DECLARE
    content_id TEXT;
    course_title TEXT;
    section_title TEXT;
    enrolled_users CURSOR FOR
        SELECT e.user_id
        FROM "Enrollment" e
        WHERE e.content_id = content_id;
    user_id TEXT;
BEGIN
    -- Get the content_id from the section the lecture was added to
    SELECT "Section".content_id, "Content".title INTO content_id, course_title
    FROM "Section"
    JOIN "Content" ON "Content".id = "Section".content_id
    WHERE "Section".id = NEW.section_id;
    
    -- Get the section title
    SELECT title INTO section_title
    FROM "Section"
    WHERE id = NEW.section_id;
    
    -- Exit if we couldn't get the content_id (shouldn't happen with proper foreign keys)
    IF content_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Loop through all enrolled users and create a notification for each
    OPEN enrolled_users;
    LOOP
        FETCH enrolled_users INTO user_id;
        EXIT WHEN NOT FOUND;
        
        -- Insert notification
        INSERT INTO "Notification" (
            id, 
            user_id, 
            content_id, 
            type, 
            title, 
            message, 
            read,
            created_at,
            action_url,
            related_item_id
        ) VALUES (
            gen_random_uuid(),
            user_id,
            content_id,
            'LECTURE_ADDED',
            'New Lecture Available',
            'A new lecture "' || NEW.title || '" was added to ' || section_title || ' in "' || course_title || '"',
            FALSE,
            NOW(),
            '/content/' || content_id || '/player/' || NEW.id,
            NEW.id
        );
    END LOOP;
    CLOSE enrolled_users;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the Lecture table
CREATE TRIGGER lecture_notification_trigger
AFTER INSERT ON "Lecture"
FOR EACH ROW
EXECUTE FUNCTION create_lecture_notifications();
