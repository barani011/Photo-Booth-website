
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// 1. SUPABASE CONFIGURATION
// ============================================

const supabaseUrl =
  'https://hhvxljqdjauyaukkfjrv.supabase.co';

const supabaseAnonKey =
  'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk';

const PHOTO_BUCKET = 'booth-photo';

// ============================================
// 2. CONNECT TO SUPABASE
// ============================================

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

// ============================================
// 3. CONVERT EVENT NAME TO FOLDER NAME
// ============================================

function getEventFolder(eventName) {
  const folder = String(eventName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!folder) {
    throw new Error('A valid event name is required.');
  }

  return folder;
}

// ============================================
// 4. UPLOAD PHOTO AND SAVE DATABASE RECORD
// ============================================

export async function uploadPhoto(
  photoBlob,
  sessionId,
  eventName
) {
  if (!(photoBlob instanceof Blob) || photoBlob.size === 0) {
    throw new Error('The captured photo is empty or invalid.');
  }

  if (!sessionId) {
    throw new Error('Session ID is required.');
  }

  if (!eventName || !String(eventName).trim()) {
    throw new Error('Event name is required.');
  }

  const eventFolder = getEventFolder(eventName);
  const photoId = crypto.randomUUID();

  const contentType = photoBlob.type || 'image/jpeg';

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const extension = extensionMap[contentType];

  if (!extension) {
    throw new Error(
      `Unsupported image format: ${contentType}`
    );
  }

  // All photos from one event share the same folder.
  const imagePath = `${eventFolder}/${photoId}.${extension}`;

  // ============================================
  // 5. UPLOAD IMAGE TO STORAGE
  // ============================================

  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, photoBlob, {
        contentType,
        upsert: false
      });

  if (uploadError) {
    console.error('STORAGE UPLOAD ERROR:', uploadError);

    throw new Error(
      `Image upload failed: ${uploadError.message}`
    );
  }

  // ============================================
  // 6. SAVE DETAILS TO DATABASE
  // ============================================

  const { data: photoRecord, error: databaseError } =
    await supabase
      .from('photos')
      .insert({
        session_id: String(sessionId),
        event_name: String(eventName).trim(),
        image_path: uploadData.path
      })
      .select()
      .single();

  if (databaseError) {
    console.error('DATABASE INSERT ERROR:', databaseError);

    // The image is already in Storage.
    // Keep it there so it is not lost.
    throw new Error(
      `Image uploaded, but database save failed: ${databaseError.message}`
    );
  }

  // ============================================
  // 7. GENERATE IMAGE URL
  // ============================================

  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  // ============================================
  // 8. RETURN SAVED PHOTO INFORMATION
  // ============================================

  const result = {
    id: photoRecord.id,
    session_id: String(sessionId),
    event_name: String(eventName).trim(),
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };

  console.log('PHOTO AND DATABASE RECORD SAVED:', result);

  return result;
}

// ============================================
// 9. GET PHOTOS FOR AN EVENT
// ============================================

export async function getEventPhotos(eventName) {
  const eventFolder = getEventFolder(eventName);

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list(eventFolder, {
      limit: 100,
      sortBy: {
        column: 'name',
        order: 'desc'
      }
    });

  if (error) {
    console.error('EVENT PHOTO LIST ERROR:', error);

    throw new Error(
      `Could not load event photos: ${error.message}`
    );
  }

  return (data || [])
    .filter(file =>
      /\.(jpg|jpeg|png|webp)$/i.test(file.name)
    )
    .map(file => {
      const imagePath = `${eventFolder}/${file.name}`;

      const { data: publicData } = supabase.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(imagePath);

      return {
        name: file.name,
        image_path: imagePath,
        publicUrl: publicData.publicUrl
      };
    });
}