
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Load Supabase configuration from your Vercel API endpoint.
const configResponse = await fetch('/api/config', {
  cache: 'no-store'
});

if (!configResponse.ok) {
  throw new Error('Could not load Supabase configuration.');
}

const { supabaseUrl, supabaseAnonKey } =
  await configResponse.json();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase URL or publishable key. Check your environment variables.'
  );
}

// Connect to Supabase.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// IMPORTANT: This must match your bucket name exactly.
const PHOTO_BUCKET = 'booth-photo';

export async function uploadPhoto(photoBlob, sessionId) {
  if (!photoBlob || !(photoBlob instanceof Blob)) {
    throw new Error('A valid photo Blob is required.');
  }

  if (!sessionId) {
    throw new Error('A valid photo session ID is required.');
  }

  const photoId = crypto.randomUUID();
  const imagePath = `${sessionId}/${photoId}.jpg`;

  // 1. Upload the image file to Supabase Storage.
  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, photoBlob, {
        contentType: 'image/jpeg',
        upsert: false
      });

  if (uploadError) {
    console.error('Photo upload failed:', uploadError.message);
    throw uploadError;
  }

  // 2. Save the image path and session ID in the database.
  const { error: databaseError } = await supabase
    .from('photos')
    .insert({
      session_id: sessionId,
      image_path: uploadData.path
    });

  if (databaseError) {
    console.error('Photo database insert failed:', databaseError.message);
    throw databaseError;
  }

  // 3. Get the image URL.
  // This works for a PUBLIC bucket.
  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  // 4. Return photo details to your existing website.
  return {
    id: photoId,
    session_id: sessionId,
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };
}