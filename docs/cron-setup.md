# Setting up Cron Jobs for Course Expiration Management

This document outlines how to set up the necessary cron jobs to manage course expiration.

## Expired Enrollment Cleanup

To automatically mark enrollments as expired and refresh the UI, we need to set up a cron job that calls our cleanup API endpoint regularly.

### API Endpoint

The cleanup API is available at:

```
/api/cron/cleanup-expired
```

It requires a secret key for authentication.

### Setting Up the Cron Job

#### Using a Cron Service (Recommended)

1. Sign up for a cron job service like [Cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com)

2. Create a new cron job with the following settings:
   - URL: `https://your-domain.com/api/cron/cleanup-expired`
   - Method: `POST`
   - Headers: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
   - Schedule: Every day at midnight (recommended)
   - Failure Notification: Enable email notifications for failures

#### Using Your Own Server

If you're hosting the application on your own server, you can set up a traditional cron job:

1. Create a shell script `cleanup-enrollments.sh`:

```bash
#!/bin/bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/cleanup-expired
```

2. Make the script executable:
```bash
chmod +x cleanup-enrollments.sh
```

3. Add it to crontab to run daily at midnight:
```bash
0 0 * * * /path/to/cleanup-enrollments.sh >> /path/to/logs/cron.log 2>&1
```

### Environment Variables

Ensure you have the following environment variable set in your application:

```
CRON_SECRET=your-secure-random-string
```

This secret should be kept secure and used only for authenticated cron job access.

## Monitoring

1. Check the application logs for any errors related to the cleanup process
2. Monitor the number of enrollments being marked as expired over time
3. Set up alerts for any unusual patterns in expired enrollments

## Additional Considerations

1. For high-traffic sites, consider running the cleanup job during off-peak hours
2. For very large enrollment databases, implement pagination in the cleanup job
3. Consider sending email notifications to users before their enrollments expire
