-- Create a function and trigger to automatically create notifications when new resources are added
-- This file will be a migration file applied to the database

-- Create a notification creation function
CREATE OR REPLACE FUNCTION create_resource_notifications()
RETURNS TRIGGER AS $$
DECLARE
    content_id TEXT;
    course_title TEXT;
    enrolled_users CURSOR FOR
        SELECT e.user_id
        FROM "Enrollment" e
        WHERE e.content_id = content_id;
    user_id TEXT;
BEGIN
    -- The content_id is already in the CourseResource table as course_id
    content_id := NEW.course_id;
    
    -- Get the course title
    SELECT title INTO course_title
    FROM "Content"
    WHERE id = content_id;
    
    -- Exit if we couldn't get the course title
    IF course_title IS NULL THEN
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
            'RESOURCE_ADDED',
            'New Resource Available',
            'A new resource "' || NEW.title || '" was added to "' || course_title || '"',
            FALSE,
            NOW(),
            '/content/' || content_id || '?tab=resources',
            NEW.id
        );
    END LOOP;
    CLOSE enrolled_users;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the CourseResource table
CREATE TRIGGER resource_notification_trigger
AFTER INSERT ON "CourseResource"
FOR EACH ROW
EXECUTE FUNCTION create_resource_notifications();
