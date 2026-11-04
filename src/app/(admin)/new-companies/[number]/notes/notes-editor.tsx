"use client";

import { useState } from "react";
import { faCheck, faPenToSquare, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type Note = { id: number; author: string; when: string; body: string };

const INITIAL: Note[] = [
  { id: 2, author: "Abi Brown", when: "Today 09:40", body: "Registered office is the director’s home address — letter should reach them." },
  { id: 1, author: "Lekan", when: "Yesterday 16:05", body: "Same director as Northfield Digital Ltd (existing client). Hold letter until we check." },
];

export function NotesEditor() {
  const toast = useToast();
  const [notes, setNotes] = useState(INITIAL);
  const [draft, setDraft] = useState("");

  return (
    <Card padding="p-6">
      <CardHeader title="Notes" />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          setNotes((n) => [{ id: Date.now(), author: "You", when: "Just now", body }, ...n]);
          setDraft("");
          toast({ message: "Note saved" });
        }}
      >
        <Field label="Add a note" htmlFor="note">
          <Textarea
            id="note"
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Director called back — interested in bookkeeping"
          />
        </Field>
        <Button type="submit" icon={faCheck} className="self-end" disabled={!draft.trim()}>
          Save note
        </Button>
      </form>

      <ul className="mt-4 flex flex-col gap-4">
        {notes.map((n) => (
          <li key={n.id} className="group rounded-[10px] bg-canvas px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium leading-[18px] text-ink">{n.author}</span>
              <span className="text-[11px] leading-[15px] text-muted">{n.when}</span>
              <span className="ml-auto flex gap-1">
                <button type="button" aria-label="Edit note" className="rounded p-1 text-muted hover:bg-white hover:text-ink">
                  <Icon icon={faPenToSquare} size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Delete note"
                  onClick={() => setNotes((list) => list.filter((x) => x.id !== n.id))}
                  className="rounded p-1 text-muted hover:bg-white hover:text-danger"
                >
                  <Icon icon={faTrashCan} size={11} />
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-[18px] text-ink">{n.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
