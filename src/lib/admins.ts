/**
 * Accounts that carry the verified mark next to their name.
 *
 * This is a label, not a permission. It decides what the header draws and nothing
 * else -- the list ships in the client bundle, so anyone can read it and a modified
 * client can claim it. Anything that actually needs protecting belongs in row-level
 * security on the table, where the client can't reach it.
 */
const ADMIN_EMAILS = ['muhammadtalhawaseem@gmail.com'];

export const isAdmin = (email?: string | null): boolean =>
    !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
