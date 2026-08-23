"use client";

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { deleteAvatar, uploadAvatar } from '../lib/avatars';
import { DISPLAY } from '../utils/typography';
import { Avatar } from '../components/Avatar';
import { Panel, PanelHeader } from '../components/Panel';

/** A fact about the account the user cannot change, in the row grammar Settings uses. */
const ReadOnlyField: React.FC<{ label: string; value: string; note?: string }> = ({
    label,
    value,
    note,
}) => (
    <div className="rounded-xl bg-slate-50/70 px-4 py-3.5 ring-1 ring-slate-900/5">
        <p
            className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-400"
            style={DISPLAY}
        >
            {label}
        </p>
        <p className="mt-2 break-all text-sm font-semibold text-slate-900">{value}</p>
        {note && <p className="mt-1.5 text-xs font-medium text-slate-500">{note}</p>}
    </div>
);

/**
 * Who the account is: the picture, the name, and the address it signs in with.
 *
 * Its own page rather than a panel on Settings, because these are facts about the
 * person rather than answers about how the app draws itself -- and the account menu,
 * which is where a user goes looking for them, is one click from both.
 *
 * Name and picture are the two things a user can change, and they save differently on
 * purpose. The picture commits the moment a file is chosen -- there is no half-picked
 * state worth holding -- while the name is typed a character at a time and would write
 * a row per keystroke, so it waits behind an explicit Save.
 */
const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const { displayName, avatarUrl, saveProfile } = useSettings();

    const [draftName, setDraftName] = useState(displayName ?? '');
    const [savingName, setSavingName] = useState(false);
    const [busyAvatar, setBusyAvatar] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    /*
     * Follows the stored value rather than seeding from it once, so a save made in
     * another tab shows up here. It cannot fight the typing: `displayName` only moves
     * when the row itself does, never on a keystroke.
     */
    useEffect(() => {
        setDraftName(displayName ?? '');
    }, [displayName]);

    const trimmed = draftName.trim();
    const stored = displayName ?? '';
    const nameDirty = trimmed !== stored;

    const handleSaveName = async () => {
        if (!nameDirty || savingName) return;

        setSavingName(true);
        // Empty means "no name", not an empty name: null is what the rest of the app
        // checks for before falling back to the email.
        const ok = await saveProfile({ displayName: trimmed || null });
        setSavingName(false);

        if (ok) toast.success(trimmed ? 'Name updated' : 'Name cleared');
    };

    const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Cleared straight away so picking the same file twice in a row still fires a
        // change event -- otherwise a failed upload could not be retried with it.
        event.target.value = '';
        if (!file || !user) return;

        setBusyAvatar(true);
        try {
            const url = await uploadAvatar(user.id, file);
            const ok = await saveProfile({ avatarUrl: url });
            if (ok) toast.success('Picture updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not upload that picture');
        } finally {
            setBusyAvatar(false);
        }
    };

    const handleRemove = async () => {
        if (!user) return;

        setBusyAvatar(true);
        try {
            // The row first. If the object delete fails the profile is already back on
            // the generated mark, which is the state the user asked for; an orphaned
            // file in the bucket is overwritten by the next upload anyway.
            const ok = await saveProfile({ avatarUrl: null });
            if (ok) {
                await deleteAvatar(user.id);
                toast.success('Picture removed');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not remove that picture');
        } finally {
            setBusyAvatar(false);
        }
    };

    const joined = user?.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : null;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 animate-in fade-in duration-500">
            <Panel>
                <PanelHeader title="Profile" caption="Who This Account Is" />

                <div className="mt-4 flex flex-col gap-3">
                    {/* Picture. The frame is the nav bar's own -- dark slab, same rounding --
                        so what is previewed here is what will appear up there. */}
                    <div className="flex items-center gap-4 rounded-xl bg-slate-50/70 px-4 py-3.5 ring-1 ring-slate-900/5">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
                            <Avatar
                                seed={user?.email}
                                src={avatarUrl}
                                alt="Your profile picture"
                                className="h-full w-full"
                            />
                        </span>

                        <div className="min-w-0 flex-1">
                            <p
                                className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-900"
                                style={DISPLAY}
                            >
                                Picture
                            </p>
                            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                                {avatarUrl
                                    ? 'Your own picture. Remove it to go back to the mark drawn from your address.'
                                    : 'A mark drawn from your address — the same one every time, and never a request that leaves the app. Upload a picture to replace it.'}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp, image/gif"
                                    onChange={handlePick}
                                    className="hidden"
                                />

                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={busyAvatar}
                                    style={DISPLAY}
                                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                    {busyAvatar
                                        ? <Loader2 size={12} className="animate-spin" />
                                        : <Upload size={12} />}
                                    {avatarUrl ? 'Replace' : 'Upload'}
                                </button>

                                {avatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        disabled={busyAvatar}
                                        style={DISPLAY}
                                        className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600 ring-1 ring-slate-900/5 transition-colors hover:bg-rose-50 disabled:opacity-50"
                                    >
                                        <Trash2 size={12} />
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Name. */}
                    <div className="rounded-xl bg-slate-50/70 px-4 py-3.5 ring-1 ring-slate-900/5">
                        <p
                            className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-slate-900"
                            style={DISPLAY}
                        >
                            Display name
                        </p>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                            What the account menu calls you. Leave it empty and the app uses the first
                            part of your address instead.
                        </p>

                        <form
                            className="mt-3 flex flex-wrap items-center gap-2"
                            onSubmit={(e) => { e.preventDefault(); void handleSaveName(); }}
                        >
                            <input
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                maxLength={60}
                                placeholder={user?.email?.split('@')[0] ?? 'Your name'}
                                aria-label="Display name"
                                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-900/5 outline-none transition-shadow placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900/20"
                            />
                            <button
                                type="submit"
                                disabled={!nameDirty || savingName}
                                style={DISPLAY}
                                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                                {savingName && <Loader2 size={12} className="animate-spin" />}
                                Save
                            </button>
                        </form>
                    </div>

                    <ReadOnlyField
                        label="Email"
                        value={user?.email ?? '—'}
                        note="This is what you sign in with, so it cannot be changed here."
                    />

                    {joined && <ReadOnlyField label="Member since" value={joined} />}
                </div>
            </Panel>
        </div>
    );
};

export default ProfilePage;
