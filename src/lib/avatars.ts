import { supabase } from './supabase';

/** Matched by the bucket's own `file_size_limit`, so a too-large file fails here first. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The square every uploaded picture is reduced to.
 *
 * The avatar is drawn at 36px in the nav bar and 80px on the Settings page, so 256
 * covers both at 3x. Storing the original instead would put a multi-megabyte photo
 * behind an <img> that renders it the size of a thumbnail.
 */
const AVATAR_SIZE = 256;

/** One file per user, overwritten in place, under a folder the RLS policies key on. */
const objectPath = (userId: string) => `${userId}/avatar.jpg`;

/**
 * Centre-crops to a square and scales to `AVATAR_SIZE`, as JPEG.
 *
 * Cropping rather than squashing: the avatar is rendered in a square frame either way,
 * and a letterboxed portrait would come out stretched. The canvas is filled white first
 * because JPEG has no alpha -- a transparent PNG would otherwise land on black.
 */
const squareThumbnail = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_SIZE;
            canvas.height = AVATAR_SIZE;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not read the image'));

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

            // The largest centred square the source can give.
            const side = Math.min(image.width, image.height);
            ctx.drawImage(
                image,
                (image.width - side) / 2,
                (image.height - side) / 2,
                side,
                side,
                0,
                0,
                AVATAR_SIZE,
                AVATAR_SIZE
            );

            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))),
                'image/jpeg',
                0.9
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That file is not an image the browser can read'));
        };

        image.src = url;
    });

/**
 * Puts the picture in the bucket and hands back the URL to store on the row.
 *
 * The path is fixed per user, so an upload replaces rather than accumulates. That makes
 * the public URL fixed too, which a CDN will happily go on serving the old bytes for --
 * hence the `?v=` stamp, which is the only reason the returned URL differs between two
 * uploads of the same account.
 */
export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
    if (file.size > AVATAR_MAX_BYTES) {
        throw new Error('That picture is larger than 5 MB');
    }

    const thumbnail = await squareThumbnail(file);
    const path = objectPath(userId);

    const { error } = await supabase.storage
        .from('avatars')
        .upload(path, thumbnail, { contentType: 'image/jpeg', upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
};

/**
 * Drops the stored object. The row's `avatar_url` is cleared by the caller -- this only
 * owns the file, and a delete that fails should not leave the profile pointing at a
 * picture that is still there.
 */
export const deleteAvatar = async (userId: string): Promise<void> => {
    const { error } = await supabase.storage.from('avatars').remove([objectPath(userId)]);
    if (error) throw new Error(error.message);
};
