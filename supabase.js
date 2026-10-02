
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
// 3. CONVERT EVENT NAME TO A FOLDER NAME
// ============================================

function getEventFolder(eventName) {
  const folder = String(eventName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!folder) {
    throw new Error('Please provide a valid event name.');
  }

  return folder;
}

// ============================================
// 4. UPLOAD PHOTO TO ITS EVENT FOLDER
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

  // Create a safe event folder name.
  const eventFolder = getEventFolder(eventName);

  // Generate a unique filename.
  const photoId = crypto.randomUUID();

  // Identify the image format.
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

  // IMPORTANT:
  // Store the photo in the EVENT folder,
  // not the individual session folder.
  const imagePath =
    `${eventFolder}/${photoId}.${extension}`;

  // ============================================
  // 5. UPLOAD IMAGE TO SUPABASE STORAGE
  // ============================================

  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, photoBlob, {
        contentType,
        upsert: false
      });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);

    throw new Error(
      `Image upload failed: ${uploadError.message}`
    );
  }

  // ============================================
  // 6. SAVE PHOTO DETAILS IN DATABASE
  // ============================================

  // This uses your existing photos table columns.
  // The event name is represented by the folder in image_path.

  // Save photo details in the Supabase database.
const { error: databaseError } = await supabase
  .from('photos')
  .insert({
    session_id: String(sessionId),
    event_name: String(eventName).trim(),
    image_path: uploadData.path
  });

if (databaseError) {
  console.error('Database insert failed:', databaseError);

  throw new Error(
    `Database save failed: ${databaseError.message}`
  );
}

  if (databaseError) {
    console.error('Database insert error:', databaseError);

    // The image has uploaded, but its database
    // record could not be saved.
    throw new Error(
      `Image uploaded, but database save failed: ${
        databaseError.message
      }`
    );
  }

  // ============================================
  // 7. GENERATE THE IMAGE URL
  // ============================================

  // Requires booth-photo to be a PUBLIC bucket.
  const { data: publicData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  // ============================================
  // 8. RETURN THE SAVED PHOTO DETAILS
  // ============================================

  const result = {
    id: photoId,
    session_id: String(sessionId),
    event_name: String(eventName).trim(),
    image_path: uploadData.path,
    publicUrl: publicData.publicUrl
  };

  console.log('Photo saved successfully:', result);

  return result;
}

// ============================================
// 9. GET ALL PHOTOS FOR AN EVENT
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
    console.error('Could not load event photos:', error);
    throw new Error(
      `Could not load event photos: ${error.message}`
    );
  }

  // Ignore nested folders and return image files only.
  return data
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