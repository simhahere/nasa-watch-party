# Cloudinary Setup Guide

## Step 1 — Create a Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com) and sign up for free
2. After login, note your **Cloud Name** from the dashboard top-left

## Step 2 — Create an Unsigned Upload Preset

1. Go to **Settings → Upload → Upload Presets**
2. Click **Add upload preset**
3. Set:
   - **Preset name**: `nasa_watch_party`
   - **Signing Mode**: `Unsigned`
   - **Folder**: `watch-party` (optional)
   - **Allowed formats**: `mp4,webm,mov,avi,mkv`
   - **Max file size**: `2000000` (2 GB in KB)
4. Click **Save**

## Step 3 — Update Environment Variables

Edit `.env.local` in your project root:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=nasa_watch_party
```

Also add these same variables to your **Vercel project settings**:
- Go to vercel.com → Your Project → Settings → Environment Variables
- Add `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

## Step 4 — Test Upload

1. Start the dev server: run `npm run dev` in the project folder
2. Open a room
3. Click **Select Video** → **Upload** tab
4. Drag a video file or click to browse
5. Watch the progress bar — after upload, the video URL is automatically shared with all room members!

## Free Plan Limits

| Feature | Free Tier |
|---|---|
| Storage | 25 GB |
| Bandwidth | 25 GB/month |
| Transformations | 25,000/month |
| Max file size | 100 MB (unsigned) / 2 GB (signed) |

> **Note**: For files larger than 100 MB, you may need a signed upload preset. The free plan is sufficient for testing and light usage.

## TURN Server Info

The app uses Open Relay (metered.ca) free TURN servers for WebRTC:
- No registration required
- Limited bandwidth (suitable for video chat, not HD streaming)
- For production with many users, register at [metered.ca](https://metered.ca) for better TURN servers
