
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Replace these with your actual Supabase project details.
const supabaseUrl = 'hhvxljqdjauyaukkfjrv';
const supabaseAnonKey = 'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk';

// Validate configuration.
if (
  !supabaseUrl.startsWith('https://') ||
  !supabaseAnonKey ||
  supabaseUrl === 'hhvxljqdjauyaukkfjrv' ||
  supabaseAnonKey === 'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk'
) {
  throw new Error(
    'Please enter your actual Supabase URL and publishable key.'
  );
}

// Connect to Supabase.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Your exact Supabase Storage bucket name.
const PHOTO_BUCKET = 'booth-photo';

export async function uploadPhoto(photoBlob, sessionId) {
  if (!(photoBlob instanceof Blob) || !sessionId) {
    throw new Error('A valid photo and session ID are required.');
  }

  const photoId = crypto.randomUUID();
  const imagePath = `${sessionId}/${photoId}.jpg`;

  // 1. Upload the image to Supabase Storage.
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

  // 2. Save the photo details in the database.
  const { error: databaseError } = await supabase
    .from('photos')
    .insert({
      session_id: sessionId,
      image_path: uploadData.path
    });

  if (databaseError) {
    console.error(
      'Photo database insert failed:',
      databaseError.message
    );
    throw databaseError;
  }

  // 3. Get the URL for the uploaded image.
  // This requires booth-photo to be a PUBLIC bucket.
  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  // 4. Return the saved photo information.
  return {
    id: photoId,
    session_id: sessionId,
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };
}