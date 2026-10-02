import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase project configuration
const supabaseUrl =
  'https://hhvxljqdjauyaukkfjrv.supabase.co';

const supabaseAnonKey =
  'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk';

// Validate configuration
if (
  !supabaseUrl.startsWith('https://') ||
  !supabaseAnonKey
) {
  throw new Error('Invalid Supabase configuration.');
}

// Connect to Supabase
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Exact bucket name from your Supabase dashboard
const PHOTO_BUCKET = 'booth-photo';

// Upload a captured photo and save its database record
export async function uploadPhoto(photoBlob, sessionId) {
  if (!(photoBlob instanceof Blob) || !sessionId) {
    throw new Error(
      'A valid photo and session ID are required.'
    );
  }

  const photoId = crypto.randomUUID();
  const imagePath = `${sessionId}/${photoId}.jpg`;

  // Step 1: Upload image to Supabase Storage
  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, photoBlob, {
        contentType: 'image/jpeg',
        upsert: false
      });

  if (uploadError) {
    console.error(
      'Supabase Storage upload failed:',
      uploadError.message
    );
    throw uploadError;
  }

  // Step 2: Save photo details in the database
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

    // The uploaded image remains in Storage if this fails.
    throw databaseError;
  }

  // Step 3: Generate the URL for a PUBLIC bucket
  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  // Step 4: Return details to the existing website
  return {
    id: photoId,
    session_id: sessionId,
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };
}