"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormField } from "@/components/forms/form-field"
import { apiFetch } from "@/lib/api"

export interface EditableJob {
  id: string | number
  title: string
  description?: string | null
  location?: string | null
  budgetMin?: number | string | null
  budgetMax?: number | string | null
}

type Field = "title" | "description" | "location" | "budgetMin" | "budgetMax"

/** The API's limits (UpdateJobDto), checked before anything is sent. */
function validate(v: Record<Field, string>): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  if (v.title.trim().length < 5) e.title = "Title must be at least 5 characters."
  else if (v.title.trim().length > 150) e.title = "Title can be at most 150 characters."
  if (v.description.trim().length < 10) e.description = "Description must be at least 10 characters."
  if (!v.location.trim()) e.location = "Service address is required."
  const min = Number(v.budgetMin)
  const max = Number(v.budgetMax)
  if (v.budgetMin.trim() === "" || !Number.isFinite(min) || min < 0) e.budgetMin = "Enter a minimum budget."
  if (v.budgetMax.trim() === "" || !Number.isFinite(max) || max < 0) e.budgetMax = "Enter a maximum budget."
  else if (!e.budgetMin && max < min) e.budgetMax = "Maximum must be greater than or equal to minimum."
  return e
}

/**
 * QA JOB-16: customers had no way to edit a posted job. Editing is offered
 * only while the job is OPEN; the server refuses changes once an artisan has
 * been accepted, because the agreed scope and price shouldn't move.
 */
export function EditJobDialog({
  job,
  open,
  onOpenChange,
  onSaved,
}: {
  job: EditableJob
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<Field, string>>({
    title: "",
    description: "",
    location: "",
    budgetMin: "",
    budgetMax: "",
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues({
      title: job.title ?? "",
      description: job.description ?? "",
      location: job.location ?? "",
      budgetMin: job.budgetMin != null ? String(Number(job.budgetMin)) : "",
      budgetMax: job.budgetMax != null ? String(Number(job.budgetMax)) : "",
    })
    setErrors({})
  }, [open, job])

  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const save = async () => {
    const found = validate(values)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(`edit-job-${first}`)?.focus()
      return
    }
    setIsSaving(true)
    try {
      await apiFetch(`/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim(),
          location: values.location.trim(),
          budgetMin: Number(values.budgetMin),
          budgetMax: Number(values.budgetMax),
        }),
      })
      toast.success("Job updated.")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this job.")
    } finally {
      setIsSaving(false)
    }
  }

  const input = (field: Field, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField id={`edit-job-${field}`} label={label} error={errors[field]}>
      {(control) => (
        <Input {...control} {...props} value={values[field]} onChange={(e) => set(field, e.target.value)} disabled={isSaving} />
      )}
    </FormField>
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
          <DialogDescription>Changes are visible to artisans straight away.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {input("title", "Job title", { maxLength: 150 })}
          <FormField id="edit-job-description" label="Description" error={errors.description}>
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                maxLength={2000}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                disabled={isSaving}
              />
            )}
          </FormField>
          {input("location", "Service address", { maxLength: 200 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {input("budgetMin", "Minimum budget (GH₵)", { type: "number", min: 0, inputMode: "decimal" })}
            {input("budgetMax", "Maximum budget (GH₵)", { type: "number", min: 0, inputMode: "decimal" })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
