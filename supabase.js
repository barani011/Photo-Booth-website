
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ========================================
// 1. SUPABASE CONFIGURATION
// ========================================

const supabaseUrl =
  'https://hhvxljqdjauyaukkfjrv.supabase.co';

const supabaseAnonKey =
  'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk';

const PHOTO_BUCKET = 'booth-photo';

// ========================================
// 2. CONNECT TO SUPABASE
// ========================================

if (
  !supabaseUrl.startsWith('https://') ||
  !supabaseAnonKey.startsWith('sb_publishable_')
) {
  throw new Error('Invalid Supabase configuration.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// ========================================
// 3. UPLOAD PHOTO AND SAVE DATABASE RECORD
// ========================================

export async function uploadPhoto(photoBlob, sessionId) {
  if (!(photoBlob instanceof Blob) || photoBlob.size === 0) {
    throw new Error('The captured photo is empty or invalid.');
  }

  if (!sessionId) {
    throw new Error('A valid photo session ID is required.');
  }

  const photoId = crypto.randomUUID();

  // Preserve the actual image format.
  const contentType = photoBlob.type || 'image/jpeg';

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[contentType] || 'jpg';

  const imagePath =
    `${sessionId}/${photoId}.${extension}`;

  // Upload the actual image to Supabase Storage.
  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, photoBlob, {
        contentType,
        upsert: false
      });

  if (uploadError) {
    console.error('SUPABASE STORAGE ERROR:', uploadError);
    throw new Error(
      `Photo upload failed: ${uploadError.message}`
    );
  }

  // Save photo details in the photos database table.
  const { error: databaseError } = await supabase
    .from('photos')
    .insert({
      session_id: String(sessionId),
      image_path: uploadData.path
    });

  if (databaseError) {
    console.error('SUPABASE DATABASE ERROR:', databaseError);

    // Remove the uploaded image if saving its record fails.
    const { error: cleanupError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([uploadData.path]);

    if (cleanupError) {
      console.error('Image cleanup failed:', cleanupError);
    }

    throw new Error(
      `Photo uploaded, but database save failed: ${databaseError.message}`
    );
  }

  // Generate the URL. This requires a PUBLIC bucket.
  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  console.log('Photo saved successfully:', uploadData.path);

  return {
    id: photoId,
    session_id: String(sessionId),
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };
}