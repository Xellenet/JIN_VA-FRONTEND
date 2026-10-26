"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Clock, FileUp, Loader2, ShieldCheck, ShieldX, X } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/forms/form-field"
import { ApiError, apiFetch } from "@/lib/api"

type DocumentType = "GHANA_CARD" | "PASSPORT" | "VOTERS_ID" | "DRIVERS_LICENSE" | "NATIONAL_ID"
type VerificationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"

interface Verification {
  id: number
  documentType: DocumentType
  status: VerificationStatus
  rejectionReason?: string | null
  createdAt: string
  reviewedAt?: string | null
}

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string; hasBack: boolean }> = [
  { value: "GHANA_CARD", label: "Ghana Card", hasBack: true },
  { value: "PASSPORT", label: "Passport", hasBack: false },
  { value: "VOTERS_ID", label: "Voter's ID", hasBack: true },
  { value: "DRIVERS_LICENSE", label: "Driver's licence", hasBack: true },
  { value: "NATIONAL_ID", label: "Other national ID", hasBack: true },
]

const MB = 1024 * 1024
const DOCUMENT_TYPES_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const SELFIE_TYPES_ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

type Slot = "front" | "back" | "selfie"

/**
 * QA KYC-01: artisans had no way to get verified from the app; only admin
 * pages used the verification API. This page shows the latest submission's
 * status and, when there is none or it was rejected, takes the ID document
 * and a selfie, uploaded to private storage (POST /uploads/document and
 * /uploads/selfie), then submits them for an admin to review.
 */
export default function ArtisanVerificationPage() {
  const [latest, setLatest] = useState<Verification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [documentType, setDocumentType] = useState<DocumentType>("GHANA_CARD")
  const [idNumber, setIdNumber] = useState("")
  const [fullLegalName, setFullLegalName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [notes, setNotes] = useState("")
  const [files, setFiles] = useState<Record<Slot, { name: string; url: string } | null>>({
    front: null,
    back: null,
    selfie: null,
  })
  const [uploading, setUploading] = useState<Slot | null>(null)
  const [errors, setErrors] = useState<Partial<Record<"front" | "selfie" | "idNumber" | "fullLegalName", string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Verification>("/verification/me")
      .then(setLatest)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) setLoadFailed(true)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const docType = DOCUMENT_TYPES.find((d) => d.value === documentType)!

  const upload = async (slot: Slot, file: File) => {
    const accepted = slot === "selfie" ? SELFIE_TYPES_ACCEPTED : DOCUMENT_TYPES_ACCEPTED
    const limit = slot === "selfie" ? 5 * MB : 10 * MB
    if (!accepted.includes(file.type)) {
      toast.error(slot === "selfie" ? "Use a JPEG, PNG or WebP photo." : "Use a JPEG, PNG, WebP or PDF file.")
      return
    }
    if (file.size > limit) {
      toast.error(`That file is too large. The limit is ${limit / MB} MB.`)
      return
    }
    setUploading(slot)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await apiFetch<{ url: string }>(slot === "selfie" ? "/uploads/selfie" : "/uploads/document", {
        method: "POST",
        body: form,
      })
      setFiles((prev) => ({ ...prev, [slot]: { name: file.name, url: res.url } }))
      setErrors((prev) => ({ ...prev, [slot === "back" ? "front" : slot]: undefined }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(null)
    }
  }

  const submit = async () => {
    const next: typeof errors = {}
    if (!fullLegalName.trim()) next.fullLegalName = "Enter your name exactly as it appears on the document"
    if (!idNumber.trim()) next.idNumber = "Enter the document number"
    if (!files.front) next.front = "Upload the front of your document"
    if (!files.selfie) next.selfie = "Upload a clear selfie"
    setErrors(next)
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0] === "fullLegalName" ? "kyc-name" : `kyc-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      const created = await apiFetch<Verification>("/verification", {
        method: "POST",
        body: JSON.stringify({
          documentType,
          idNumber: idNumber.trim(),
          fullLegalName: fullLegalName.trim(),
          ...(dateOfBirth ? { dateOfBirth } : {}),
          documentFrontUrl: files.front!.url,
          ...(docType.hasBack && files.back ? { documentBackUrl: files.back.url } : {}),
          selfieUrl: files.selfie!.url,
          ...(notes.trim() ? { additionalNotes: notes.trim() } : {}),
        }),
      })
      setLatest(created)
      toast.success("Submitted. We'll let you know once an admin has reviewed it.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your verification.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const showForm = !latest || latest.status === "REJECTED"

  const fileSlot = (slot: Slot, label: string, optional = false) => {
    const current = files[slot]
    const error = slot === "back" ? undefined : errors[slot]
    const accept = (slot === "selfie" ? SELFIE_TYPES_ACCEPTED : DOCUMENT_TYPES_ACCEPTED).join(",")
    return (
      <FormField
        id={`kyc-${slot}`}
        label={label}
        optional={optional}
        error={error}
        hint={slot === "selfie" ? "Face the camera in good light, without sunglasses or a hat. Up to 5 MB." : "A clear photo or scan, all four corners visible. Up to 10 MB."}
      >
        {(control) =>
          current ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span className="truncate">{current.name}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={() => setFiles((prev) => ({ ...prev, [slot]: null }))}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {uploading === slot ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {uploading === slot ? "Uploading…" : "Choose a file"}
              <input
                {...control}
                type="file"
                accept={accept}
                className="sr-only"
                disabled={uploading != null || isSubmitting}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void upload(slot, file)
                }}
              />
            </label>
          )
        }
      </FormField>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Identity Verification</h1>
          <p className="text-muted-foreground">
            Verified artisans get a badge on their profile, so customers know who they&apos;re hiring.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadFailed ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load your verification status. Refresh to try again.
            </CardContent>
          </Card>
        ) : (
          <>
            {latest && (
              <Card>
                <CardContent className="flex items-start gap-4 p-5">
                  {latest.status === "APPROVED" ? (
                    <ShieldCheck className="h-6 w-6 shrink-0 text-success" />
                  ) : latest.status === "REJECTED" ? (
                    <ShieldX className="h-6 w-6 shrink-0 text-destructive" />
                  ) : (
                    <Clock className="h-6 w-6 shrink-0 text-warning" />
                  )}
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {latest.status === "APPROVED"
                        ? "You're verified"
                        : latest.status === "REJECTED"
                          ? "Your last submission wasn't approved"
                          : "Your documents are being reviewed"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {latest.status === "APPROVED"
                        ? "Your profile shows the verified badge."
                        : latest.status === "REJECTED"
                          ? latest.rejectionReason
                            ? `Reason: ${latest.rejectionReason}`
                            : "Please check your documents and submit again."
                          : `Submitted ${new Date(latest.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. We'll notify you when an admin has checked them.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {showForm && (
              <Card>
                <CardContent className="p-6">
                  <form
                    noValidate
                    className="space-y-5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void submit()
                    }}
                  >
                    <FormField id="kyc-type" label="Document type">
                      {(control) => (
                        <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                          <SelectTrigger id={control.id} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField id="kyc-name" label="Full legal name" error={errors.fullLegalName}>
                        {(control) => (
                          <Input
                            {...control}
                            value={fullLegalName}
                            maxLength={200}
                            autoComplete="name"
                            onChange={(e) => {
                              setFullLegalName(e.target.value)
                              setErrors((p) => ({ ...p, fullLegalName: undefined }))
                            }}
                          />
                        )}
                      </FormField>
                      <FormField id="kyc-idNumber" label="Document number" error={errors.idNumber}>
                        {(control) => (
                          <Input
                            {...control}
                            value={idNumber}
                            maxLength={100}
                            placeholder={documentType === "GHANA_CARD" ? "GHA-123456789-0" : undefined}
                            onChange={(e) => {
                              setIdNumber(e.target.value)
                              setErrors((p) => ({ ...p, idNumber: undefined }))
                            }}
                          />
                        )}
                      </FormField>
                    </div>
                    <FormField id="kyc-dob" label="Date of birth" optional>
                      {(control) => (
                        <Input
                          {...control}
                          type="date"
                          value={dateOfBirth}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="md:w-1/2"
                        />
                      )}
                    </FormField>
                    <div className="grid gap-5 md:grid-cols-2">
                      {fileSlot("front", "Front of document")}
                      {docType.hasBack && fileSlot("back", "Back of document", true)}
                    </div>
                    {fileSlot("selfie", "Selfie")}
                    <FormField id="kyc-notes" label="Anything the reviewer should know" optional>
                      {(control) => (
                        <Textarea
                          {...control}
                          rows={3}
                          maxLength={1000}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      )}
                    </FormField>
                    <p className="text-xs text-muted-foreground">
                      Your documents are stored privately and only JinVa admins can see them.
                    </p>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={isSubmitting || uploading != null}
                      >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit for review
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
