"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { faCheck, faPenToSquare, faSpinner, faTrashCan, faXmark } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { addNoteAction, deleteNoteAction, editNoteAction } from "@/lib/notes/actions";
import type { NoteItem } from "@/lib/notes/queries";

export function NotesEditor({ companyNumber, notes }: { companyNumber: string; notes: NoteItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      const r = await addNoteAction(companyNumber, draft);
      if (!r.ok) return setError(r.message);
      setDraft("");
      setError(null);
      router.refresh();
      toast({ message: "Note saved" });
    });

  const saveEdit = () =>
    editing &&
    start(async () => {
      setBusyId(editing.id);
      const r = await editNoteAction(editing.id, editing.text);
      setBusyId(null);
      if (!r.ok) return toast({ message: r.message });
      setEditing(null);
      router.refresh();
      toast({ message: "Note updated" });
    });

  const remove = (id: string) =>
    start(async () => {
      setBusyId(id);
      const r = await deleteNoteAction(id);
      setBusyId(null);
      if (!r.ok) return toast({ message: r.message });
      router.refresh();
      toast({ message: "Note deleted" });
    });

  return (
    <Card padding="p-6">
      <CardHeader title="Notes" aside={<span className="text-[11px] font-medium text-muted">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>} />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add();
        }}
      >
        <Field label="Add a note" htmlFor="note" error={error}>
          <Textarea
            id="note"
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => (setDraft(e.target.value), setError(null))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && draft.trim()) add();
            }}
            placeholder="e.g. Director called back — interested in bookkeeping"
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <span className="text-[11px] text-muted">{draft.length}/2000 · Ctrl+Enter to save</span>
          <Button type="submit" icon={pending && !busyId ? faSpinner : faCheck} disabled={!draft.trim() || pending}>
            Save note
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="mt-4 rounded-[10px] bg-canvas px-4 py-6 text-center text-[12px] text-muted">No notes yet for this company.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {notes.map((n) => (
            <li key={n.id} className="rounded-[10px] bg-canvas px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium leading-[18px] text-ink">{n.author}</span>
                <span className="text-[11px] leading-[15px] text-muted">
                  {n.when}
                  {n.edited ? " · edited" : ""}
                </span>
                {n.mine && editing?.id !== n.id ? (
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      aria-label="Edit note"
                      onClick={() => setEditing({ id: n.id, text: n.body })}
                      className="rounded p-1 text-muted hover:bg-white hover:text-ink"
                    >
                      <Icon icon={faPenToSquare} size={11} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete note"
                      disabled={busyId === n.id}
                      onClick={() => remove(n.id)}
                      className="rounded p-1 text-muted hover:bg-white hover:text-danger"
                    >
                      <Icon icon={busyId === n.id ? faSpinner : faTrashCan} size={11} spin={busyId === n.id} />
                    </button>
                  </span>
                ) : null}
              </div>
              {editing?.id === n.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Textarea
                    aria-label="Edit note"
                    rows={3}
                    maxLength={2000}
                    value={editing.text}
                    onChange={(e) => setEditing({ id: n.id, text: e.target.value })}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" icon={faXmark} onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" icon={busyId === n.id ? faSpinner : faCheck} onClick={saveEdit} disabled={!editing.text.trim() || pending}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[18px] text-ink">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
