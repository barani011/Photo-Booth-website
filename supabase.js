import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl =
  'https://hhvxljqdjauyaukkfjrv.supabase.co';

const supabaseAnonKey =
  'sb_publishable__zZFUxr31uLZ1CkFvS6AFg_BQivX8hk';

const PHOTO_BUCKET = 'booth-photo';

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


// ============================================================
// EVENT FOLDER
// ============================================================

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


// ============================================================
// UPLOAD PHOTO
// ============================================================

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

  const cleanEventName = String(eventName).trim();
  const eventFolder = getEventFolder(cleanEventName);

  const photoId = crypto.randomUUID();

  const contentType =
    photoBlob.type || 'image/jpeg';

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


  // ----------------------------------------------------------
  // STORAGE PATH
  // ----------------------------------------------------------

  const imagePath =
    `${eventFolder}/${photoId}.${extension}`;


  // ----------------------------------------------------------
  // UPLOAD TO STORAGE
  // ----------------------------------------------------------

  const {
    data: uploadData,
    error: uploadError
  } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(
      imagePath,
      photoBlob,
      {
        contentType,
        upsert: false
      }
    );

  if (uploadError) {
    console.error(
      'STORAGE UPLOAD ERROR:',
      uploadError
    );

    throw new Error(
      `Image upload failed: ${uploadError.message}`
    );
  }


  // ----------------------------------------------------------
  // SAVE DATABASE RECORD
  // ----------------------------------------------------------

  const {
    data: photoRecord,
    error: databaseError
  } = await supabase
    .from('photos')
    .insert({
      session_id: String(sessionId),
      event_name: cleanEventName,
      image_path: uploadData.path
    })
    .select()
    .single();

  if (databaseError) {
    console.error(
      'DATABASE INSERT ERROR:',
      databaseError
    );

    throw new Error(
      `Image uploaded, but database save failed: ${databaseError.message}`
    );
  }


  // ----------------------------------------------------------
  // PUBLIC URL
  // ----------------------------------------------------------

  const {
    data: publicData
  } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);


  return {
    id: photoRecord.id,
    session_id: String(sessionId),
    event_name: cleanEventName,
    image_path: uploadData.path,
    created_at: photoRecord.created_at,
    publicUrl: publicData.publicUrl
  };
}


// ============================================================
// GET PHOTOS FROM DATABASE
//
// IMPORTANT:
// This reads from the `photos` TABLE.
// It does NOT read directly from Storage.
//
// Therefore Gallery only shows photos that have a
// corresponding database record.
// ============================================================

export async function getEventPhotos(eventName) {

  if (!eventName || !String(eventName).trim()) {
    throw new Error('Event name is required.');
  }

  const cleanEventName =
    String(eventName).trim();


  const {
    data,
    error
  } = await supabase
    .from('photos')
    .select(`
      id,
      session_id,
      event_name,
      image_path,
      created_at
    `)
    .eq(
      'event_name',
      cleanEventName
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      'DATABASE PHOTO LIST ERROR:',
      error
    );

    throw new Error(
      `Could not load event photos: ${error.message}`
    );
  }


  return (data || [])
    .map(photo => {

      const {
        data: publicData
      } = supabase.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(
          photo.image_path
        );


      return {

        id: photo.id,

        session_id:
          photo.session_id,

        event_name:
          photo.event_name,

        image_path:
          photo.image_path,

        created_at:
          photo.created_at,

        publicUrl:
          publicData.publicUrl

      };

    });

}


// ============================================================
// GET PHOTOS FROM ONE CAPTURE SESSION
//
// Used by share.html when an old Gallery photo is opened.
// ============================================================

export async function getSessionPhotos(
  sessionId,
  eventName
) {

  if (!sessionId) {
    throw new Error(
      'Session ID is required.'
    );
  }


  let query = supabase
    .from('photos')
    .select(`
      id,
      session_id,
      event_name,
      image_path,
      created_at
    `)
    .eq(
      'session_id',
      String(sessionId)
    )
    .order(
      'created_at',
      {
        ascending: true
      }
    );


  if (
    eventName &&
    String(eventName).trim()
  ) {
    query = query.eq(
      'event_name',
      String(eventName).trim()
    );
  }


  const {
    data,
    error
  } = await query;


  if (error) {

    console.error(
      'SESSION PHOTO LIST ERROR:',
      error
    );

    throw new Error(
      `Could not load capture session: ${error.message}`
    );
  }


  return (data || [])
    .map(photo => {

      const {
        data: publicData
      } = supabase.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(
          photo.image_path
        );


      return {

        id: photo.id,

        session_id:
          photo.session_id,

        event_name:
          photo.event_name,

        image_path:
          photo.image_path,

        created_at:
          photo.created_at,

        publicUrl:
          publicData.publicUrl

      };

    });

}